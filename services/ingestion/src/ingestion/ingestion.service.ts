import {
  ChirpStackUplinkSchema,
  type ReadingCreatedEvent,
  SensorReadingSchema,
} from '@aq/contracts';
import { createTelemetryDb, readings, type TelemetryDb } from '@aq/db';
import { calculateAqi } from '@aq/domain';
import { createCounter, createLogger } from '@aq/observability';
import { decodeUplink } from '@aq/telemetry-codec';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { connect, type MqttClient } from 'mqtt';

const UPLINK_TOPIC = 'application/+/device/+/event/up';
const READINGS_CHANNEL = 'readings'; // Redis Pub/Sub channel for realtime fan-out
const LATEST_KEY = (deviceId: string): string => `sensor:latest:${deviceId}`;

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly log = createLogger('ingestion');
  private readonly readingsIngested = createCounter(
    'readings_ingested',
    'Uplinks decoded, AQI-computed, and persisted',
  );
  private readonly db: TelemetryDb;
  private readonly redis: Redis;
  private client?: MqttClient;

  constructor(private readonly config: ConfigService) {
    this.db = createTelemetryDb(this.telemetryUrl());
    this.redis = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: false,
      maxRetriesPerRequest: null,
    });
  }

  onModuleInit(): void {
    const url = this.config.get<string>('MQTT_URL', 'mqtt://localhost:1883');
    this.log.info('connecting to MQTT broker', { url });
    this.client = connect(url);
    this.client.on('connect', () => {
      this.client?.subscribe(UPLINK_TOPIC, (err) => {
        if (err) this.log.error('subscribe failed', { error: String(err) });
        else this.log.info('subscribed', { topic: UPLINK_TOPIC });
      });
    });
    this.client.on('message', (topic, payload) => {
      void this.handleUplink(topic, payload);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.endAsync();
    this.redis.disconnect();
  }

  private async handleUplink(topic: string, raw: Buffer): Promise<void> {
    try {
      // 1) Parse + validate the ChirpStack application-uplink envelope.
      const uplink = ChirpStackUplinkSchema.parse(JSON.parse(raw.toString('utf8')));
      const deviceId = uplink.deviceInfo.devEui;

      // 2) Decode the base64 frmPayload with the shared codec (same layout as firmware).
      const bytes = new Uint8Array(Buffer.from(uplink.data, 'base64'));
      const decoded = decodeUplink(bytes);
      const rssi = uplink.rxInfo?.[0]?.rssi;

      // Normalise ChirpStack's RFC3339 time (nanosecond precision) to strict ISO.
      const parsed = uplink.time ? new Date(uplink.time) : new Date();
      const timestamp = Number.isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();

      // 3) Compute AQI and validate against the shared contract.
      const aqi = calculateAqi(decoded.pm25, decoded.pm10);
      const reading = SensorReadingSchema.parse({
        deviceId,
        timestamp,
        pm25: decoded.pm25,
        pm10: decoded.pm10,
        temperature: decoded.temperature,
        humidity: decoded.humidity,
        pressure: decoded.pressure,
        batteryMv: decoded.batteryMv,
        signalStrength: rssi !== undefined ? Math.round(rssi) : undefined,
      });

      // 4) Persist to TimescaleDB.
      await this.db.insert(readings).values({
        time: new Date(reading.timestamp),
        sensorId: reading.deviceId,
        pm25: reading.pm25,
        pm10: reading.pm10,
        temperature: reading.temperature,
        humidity: reading.humidity,
        pressure: reading.pressure,
        aqi: aqi.aqi,
        aqiCategory: aqi.category,
        batteryMv: reading.batteryMv,
        signalStrength: reading.signalStrength,
      });

      // 5) Update the latest-value cache and broadcast on Pub/Sub.
      const event: ReadingCreatedEvent = {
        type: 'reading.created',
        payload: {
          ...reading,
          id: `${reading.deviceId}:${reading.timestamp}`,
          sensorId: reading.deviceId,
          aqi: aqi.aqi,
          aqiCategory: aqi.category,
        },
      };
      await this.redis.set(LATEST_KEY(deviceId), JSON.stringify(event.payload));
      await this.redis.publish(READINGS_CHANNEL, JSON.stringify(event));

      this.readingsIngested.add(1, { category: aqi.category });
      this.log.info('reading ingested', { deviceId, aqi: aqi.aqi, category: aqi.category });
    } catch (err) {
      this.log.error('failed to ingest uplink', { topic, error: String(err) });
    }
  }

  private telemetryUrl(): string {
    const host = this.config.get<string>('TSDB_HOST', 'timescaledb');
    const port = this.config.get<string>('TSDB_PORT', '5432');
    const user = this.config.get<string>('TSDB_USERNAME', 'airquality');
    const pass = this.config.get<string>('TSDB_PASSWORD', 'airquality');
    const name = this.config.get<string>('TSDB_NAME', 'telemetry');
    return `postgres://${user}:${pass}@${host}:${port}/${name}`;
  }
}

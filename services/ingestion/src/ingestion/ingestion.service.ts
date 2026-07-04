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
const DATA_FPORT = 2; // telemetry uplinks (config downlinks use fPort 10)

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
      commandTimeout: 10_000, // fail a command rather than hang forever on a Redis outage
    });
  }

  onModuleInit(): void {
    const url = this.config.get<string>('MQTT_URL', 'mqtt://localhost:1883');
    this.log.info('connecting to MQTT broker', { url });
    // Persistent session (clean:false + stable clientId) + QoS 1 so uplinks
    // published while ingestion is restarting are queued, not lost.
    this.client = connect(url, { clientId: 'aq-ingestion', clean: false });
    this.client.on('connect', () => {
      this.client?.subscribe(UPLINK_TOPIC, { qos: 1 }, (err) => {
        if (err) this.log.error('subscribe failed', { error: String(err) });
        else this.log.info('subscribed', { topic: UPLINK_TOPIC });
      });
    });
    // Without an 'error' listener, mqtt.js re-emits broker errors as an unhandled
    // exception that crashes the process instead of using its built-in reconnect.
    this.client.on('error', (err) => this.log.error('mqtt error', { error: String(err) }));
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

      // Only telemetry uplinks (fPort 2) decode as readings — a config downlink
      // channel now uses fPort 10, and other ports aren't our payload layout.
      if (uplink.fPort !== DATA_FPORT) {
        this.log.debug('ignoring non-telemetry uplink', { deviceId, fPort: uplink.fPort });
        return;
      }

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

import {
  ChirpStackUplinkSchema,
  type ReadingCreatedEvent,
  ReportedConfigurationSchema,
  SensorReadingSchema,
} from '@aq/contracts';
import {
  ConfigurationStore,
  configurationPolicy,
  createTelemetryDb,
  readings,
  type TelemetryDb,
} from '@aq/db';
import { calculateAqi } from '@aq/domain';
import { createCounter, createLogger } from '@aq/observability';
import {
  CONFIG_REPORT_FPORT,
  ConfigResult,
  decodeConfigReport,
  decodeUplink,
} from '@aq/telemetry-codec';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { connect, type MqttClient } from 'mqtt';
import { configurationRoute } from './configuration-routing';
import { ConfigurationWorker, routingKey } from './configuration-worker';

const UPLINK_TOPIC = 'application/+/device/+/event/up';
const READINGS_CHANNEL = 'readings'; // Redis Pub/Sub channel for realtime fan-out
const LATEST_KEY = (deviceId: string): string => `sensor:latest:${deviceId}`;
const DATA_FPORT = 2; // telemetry uplinks (config downlinks use fPort 10)
// The settings each node last reported (fPort 11). No TTL: it stays true until
// the node reports again.
const RESULT_NAMES: Record<ConfigResult, string> = {
  [ConfigResult.None]: 'none',
  [ConfigResult.Applied]: 'applied',
  [ConfigResult.OutOfRange]: 'out_of_range',
  [ConfigResult.Malformed]: 'malformed',
};
// Latest-value cache TTL: refreshed every uplink (~5 min) while a sensor is alive;
// a dead sensor's stale "latest" then expires instead of lingering forever.
const LATEST_TTL_SECONDS = 7200; // 2h

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly log = createLogger('ingestion');
  private readonly readingsIngested = createCounter(
    'readings_ingested',
    'Uplinks decoded, AQI-computed, and persisted',
  );
  private readonly readingsDropped = createCounter(
    'readings_dropped',
    'Uplinks dropped before persistence (incomplete sensors, or a decode/persist error)',
  );
  private readonly db: TelemetryDb;
  private readonly redis: Redis;
  private client?: MqttClient;
  private readonly configuration: ConfigurationStore;
  private worker?: ConfigurationWorker;

  constructor(private readonly config: ConfigService) {
    this.db = createTelemetryDb(this.telemetryUrl());
    this.redis = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      commandTimeout: 10_000, // fail a command rather than hang forever on a Redis outage
    });
    this.configuration = new ConfigurationStore(this.redis, configurationPolicy(process.env));
  }

  onModuleInit(): void {
    const url = this.config.get<string>('MQTT_URL', 'mqtt://localhost:1883');
    const clientId = this.config.get<string>('MQTT_CLIENT_ID', 'aq-ingestion');
    const shareGroup = this.config.get<string>('MQTT_SHARED_GROUP', '');
    // clean:false + a STABLE per-instance clientId keeps a persistent session, so
    // uplinks published while THIS instance restarts are queued (QoS 1), not lost.
    // To scale horizontally, set MQTT_SHARED_GROUP (and a unique MQTT_CLIENT_ID per
    // replica): a $share/ subscription load-balances uplinks across the group.
    // Shared subs only distribute among ONLINE members, so single-instance stays on
    // the plain topic to keep the queue-on-restart guarantee.
    const topic = shareGroup ? `$share/${shareGroup}/${UPLINK_TOPIC}` : UPLINK_TOPIC;
    this.log.info('connecting to MQTT broker', { url, clientId, topic });
    this.client = connect(url, { clientId, clean: false });
    this.client.on('connect', () => {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) this.log.error('subscribe failed', { error: String(err) });
        else this.log.info('subscribed', { topic });
      });
    });
    // Without an 'error' listener, mqtt.js re-emits broker errors as an unhandled
    // exception that crashes the process instead of using its built-in reconnect.
    this.client.on('error', (err) => this.log.error('mqtt error', { error: String(err) }));
    this.client.on('message', (topic, payload) => {
      void this.handleUplink(topic, payload);
    });
    this.worker = new ConfigurationWorker(
      this.redis,
      this.configuration,
      (downTopic, payload) => this.publishDownlink(downTopic, payload),
      this.config.get<string>('CHIRPSTACK_APPLICATION_ID'),
    );
    this.worker.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.stop();
    await this.client?.endAsync(true);
    this.redis.disconnect();
  }

  private async handleUplink(topic: string, raw: Buffer): Promise<void> {
    try {
      // 1) Parse + validate the ChirpStack application-uplink envelope.
      const uplink = ChirpStackUplinkSchema.parse(JSON.parse(raw.toString('utf8')));
      const { deviceId, applicationId } = configurationRoute(topic, uplink);

      if (uplink.fPort === CONFIG_REPORT_FPORT) {
        // Decode first: malformed application payloads must not establish routing.
        decodeConfigReport(new Uint8Array(Buffer.from(uplink.data, 'base64')));
        await this.redis.set(routingKey(deviceId), applicationId);
        await this.handleConfigReport(deviceId, uplink.data, uplink.time);
        return;
      }

      // Only telemetry uplinks (fPort 2) decode as readings — a config downlink
      // channel now uses fPort 10, and other ports aren't our payload layout.
      if (uplink.fPort !== DATA_FPORT) {
        this.log.debug('ignoring non-telemetry uplink', { deviceId, fPort: uplink.fPort });
        return;
      }

      // 2) Decode the base64 frmPayload with the shared codec (same layout as firmware).
      const bytes = new Uint8Array(Buffer.from(uplink.data, 'base64'));
      const decoded = decodeUplink(bytes);
      await this.redis.set(routingKey(deviceId), applicationId);

      // A node with a dead sensor clears its presence bit and zero-fills the field.
      // Until per-field nullable persistence lands, persisting pm25=0 as a real
      // reading would broadcast "AQI 0 / good" for a node with no working PM sensor
      // — worse than the honest data gap. So drop partial readings (and count them,
      // so the missing sensor is visible in metrics rather than silently absent).
      if (!decoded.sensorsPresent?.pm && !decoded.sensorsPresent?.env) {
        // Every sensor failed: the node still sends its battery as a heartbeat.
        this.readingsDropped.add(1, { reason: 'no_sensors' });
        this.log.warn('heartbeat without sensor data', { deviceId, batteryMv: decoded.batteryMv });
        return;
      }
      if (!decoded.sensorsPresent?.pm || !decoded.sensorsPresent?.env) {
        this.readingsDropped.add(1, { reason: 'incomplete_sensors' });
        this.log.warn('dropping incomplete reading', { deviceId, present: decoded.sensorsPresent });
        return;
      }

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

      // 4) Persist to TimescaleDB. A re-delivered uplink (same sensor_id + time)
      //    is a harmless no-op rather than a thrown duplicate-key error.
      await this.db
        .insert(readings)
        .values({
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
        })
        .onConflictDoNothing();

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
      await this.redis.set(
        LATEST_KEY(deviceId),
        JSON.stringify(event.payload),
        'EX',
        LATEST_TTL_SECONDS,
      );
      await this.redis.publish(READINGS_CHANNEL, JSON.stringify(event));

      this.readingsIngested.add(1, { category: aqi.category });
      this.log.info('reading ingested', { deviceId, aqi: aqi.aqi, category: aqi.category });
    } catch (err) {
      this.readingsDropped.add(1, { reason: 'error' });
      this.log.error('failed to ingest uplink', { topic, error: String(err) });
    }
  }

  /** Cache the settings a node reports it is running (after a config downlink or
   * a cold boot), so the server can confirm a change took effect. */
  private async handleConfigReport(deviceId: string, data: string, time?: string): Promise<void> {
    const report = decodeConfigReport(new Uint8Array(Buffer.from(data, 'base64')));
    const now = Date.now();
    const trustedTime = Boolean(time && !Number.isNaN(Date.parse(time)) && Date.parse(time) <= now);
    const reportedAt = trustedTime && time ? new Date(time) : new Date(now);
    const config = ReportedConfigurationSchema.parse({
      deviceId,
      intervalS: report.intervalS,
      pmOffset: report.pmOffsetX10 / 10,
      temperatureOffset: report.tempOffsetX100 / 100,
      lastCommand: report.lastCommand,
      lastResult: RESULT_NAMES[report.lastResult],
      reportedAt: reportedAt.toISOString(),
    });
    await this.configuration.report(config, trustedTime);
    this.log.info('config report', config);
  }

  private async publishDownlink(topic: string, payload: string): Promise<void> {
    const client = this.client;
    if (!client?.connected) throw new Error('MQTT broker is disconnected');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('MQTT acknowledgement timed out; delivery is uncertain')),
          10_000,
        );
        client.publish(topic, payload, { qos: 1, retain: false }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private telemetryUrl(): string {
    const host = this.config.get<string>('TSDB_HOST', 'timescaledb');
    const port = this.config.get<string>('TSDB_PORT', '5432');
    const user = this.config.get<string>('TSDB_USERNAME', 'airquality');
    const pass = this.config.get<string>('TSDB_PASSWORD', 'airquality');
    const name = this.config.get<string>('TSDB_NAME', 'telemetry');
    // Encode credentials so a password with URL-reserved chars (@ : / #) is safe.
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}`;
  }
}

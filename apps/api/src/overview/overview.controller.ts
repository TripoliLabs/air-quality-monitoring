import type { NetworkHourlyBucket, NetworkOverview, ReadingResponse } from '@aq/contracts';
import { type RelationalDb, readings, sensors, type TelemetryDb } from '@aq/db';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { eq, gte, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { RELATIONAL_DB, TELEMETRY_DB } from '../database/database.module';
import { NetworkHourlyBucketDto, NetworkOverviewDto } from '../dto';
import { REDIS } from '../redis/redis.module';

const ONLINE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Neighbourhood names are free text, typed by whoever registered the sensor.
 * Compare them ignoring case, spacing and punctuation ("El Mina", "el-mina ",
 * "EL MINA" are one place), the way the dashboard groups them.
 */
const placeKey = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');

@ApiTags('overview')
@Controller('overview')
export class OverviewController {
  constructor(
    @Inject(RELATIONAL_DB) private readonly relational: RelationalDb,
    @Inject(TELEMETRY_DB) private readonly telemetry: TelemetryDb,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** A network-wide snapshot for the dashboard overview (online count, AQI, categories). */
  @Get()
  @ApiOperation({ summary: 'Network-wide snapshot (online count, AQI, category breakdown)' })
  @ApiOkResponse({ type: NetworkOverviewDto })
  async overview(): Promise<NetworkOverview> {
    const sensorRows = await this.relational
      .select({ deviceId: sensors.deviceId })
      .from(sensors)
      .where(eq(sensors.isActive, true));
    const sensorsTotal = sensorRows.length;

    const latest = sensorsTotal
      ? (await this.redis.mget(sensorRows.map((r) => `sensor:latest:${r.deviceId}`)))
          .filter((v): v is string => v !== null)
          .map((v) => JSON.parse(v) as ReadingResponse)
      : [];

    const now = Date.now();
    const online = latest.filter((r) => now - new Date(r.timestamp).getTime() < ONLINE_WINDOW_MS);
    const aqis = online.map((r) => r.aqi);
    const byCategory: Record<string, number> = {};
    for (const r of online) byCategory[r.aqiCategory] = (byCategory[r.aqiCategory] ?? 0) + 1;

    const counted = await this.telemetry
      .select({ n: sql<number>`count(*)::int` })
      .from(readings)
      .where(gte(readings.time, new Date(now - 60 * 60 * 1000)));

    return {
      sensorsTotal,
      sensorsOnline: online.length,
      readingsLastHour: counted[0]?.n ?? 0,
      avgAqi: aqis.length ? Math.round(aqis.reduce((a, b) => a + b, 0) / aqis.length) : null,
      maxAqi: aqis.length ? Math.max(...aqis) : null,
      byCategory,
      updatedAt: new Date(now).toISOString(),
    };
  }

  /**
   * Hour-bucketed history for the whole network, or for one neighbourhood —
   * one request where a client would otherwise fetch every sensor's history.
   * Covers registered, active sensors only.
   * Each bucket is the mean of the per-sensor hourly averages in
   * `readings_hourly`, so a sensor counts once however often it sampled.
   * Default 7 days, max 90. Chronological.
   */
  @Get('history')
  @ApiOperation({
    summary: 'Hour-bucketed network history (last `days`, default 7), optionally one neighbourhood',
  })
  @ApiQuery({ name: 'days', required: false, description: '1–90, default 7' })
  @ApiQuery({
    name: 'neighborhood',
    required: false,
    description:
      'Restrict to sensors in this neighbourhood (name as in GET /sensors; case, spacing and punctuation are ignored)',
  })
  @ApiOkResponse({ type: NetworkHourlyBucketDto, isArray: true })
  async history(
    @Query('days') days?: string,
    @Query('neighborhood') neighborhood?: string,
  ): Promise<NetworkHourlyBucket[]> {
    const windowDays = Math.min(Math.max(Number(days) || 7, 1), 90);

    // Only registered, active sensors count — the same set the live figures
    // use — so a retired unit that still transmits, or a device that is in
    // ChirpStack but not registered, cannot skew the history. Sensor metadata
    // is in the relational DB and readings in TimescaleDB; the two cannot
    // join, so resolve the device IDs first.
    const active = await this.relational
      .select({ deviceId: sensors.deviceId, neighborhood: sensors.neighborhood })
      .from(sensors)
      .where(eq(sensors.isActive, true));
    const wanted = neighborhood ? placeKey(neighborhood) : null;
    const deviceIds = active
      .filter((r) => wanted === null || (r.neighborhood && placeKey(r.neighborhood) === wanted))
      .map((r) => r.deviceId);
    if (deviceIds.length === 0) return [];
    const inScope = sql`AND sensor_id IN (${sql.join(
      deviceIds.map((id) => sql`${id}`),
      sql`, `,
    )})`;

    const result = await this.telemetry.execute(sql`
      SELECT bucket,
             avg(avg_pm25)        AS avg_pm25,
             avg(avg_pm10)        AS avg_pm10,
             avg(avg_temperature) AS avg_temperature,
             avg(avg_humidity)    AS avg_humidity,
             max(max_aqi)         AS max_aqi,
             count(*)             AS sensor_count,
             sum(sample_count)    AS sample_count
      FROM readings_hourly
      WHERE bucket >= now() - make_interval(days => ${windowDays}) ${inScope}
      GROUP BY bucket
      ORDER BY bucket ASC
    `);
    const rows = result as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      bucket: new Date(r.bucket as string).toISOString(),
      avgPm25: Number(r.avg_pm25),
      avgPm10: Number(r.avg_pm10),
      avgTemperature: Number(r.avg_temperature),
      avgHumidity: Number(r.avg_humidity),
      maxAqi: Number(r.max_aqi),
      sensorCount: Number(r.sensor_count),
      sampleCount: Number(r.sample_count),
    }));
  }
}

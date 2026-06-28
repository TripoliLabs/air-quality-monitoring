import type { HourlyBucket, ReadingResponse, Sensor } from '@aq/contracts';
import { type RelationalDb, readings, sensors, type TelemetryDb } from '@aq/db';
import { Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { RELATIONAL_DB, TELEMETRY_DB } from '../database/database.module';
import { HourlyBucketDto, ReadingResponseDto, SensorDto } from '../dto';
import { REDIS } from '../redis/redis.module';

const LATEST_KEY = (deviceId: string): string => `sensor:latest:${deviceId}`;

@ApiTags('sensors')
@Controller('sensors')
export class SensorsController {
  constructor(
    @Inject(RELATIONAL_DB) private readonly relational: RelationalDb,
    @Inject(TELEMETRY_DB) private readonly telemetry: TelemetryDb,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all sensors with their metadata' })
  @ApiOkResponse({ type: SensorDto, isArray: true })
  async findAll(): Promise<Sensor[]> {
    const rows = await this.relational.select().from(sensors);
    return rows.map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      neighborhood: r.neighborhood ?? undefined,
      isActive: r.isActive,
    }));
  }

  /** Latest reading for every sensor (bulk), served from the Redis cache. */
  @Get('latest')
  @ApiOperation({ summary: 'Latest reading for every sensor (bulk)' })
  @ApiOkResponse({ type: ReadingResponseDto, isArray: true })
  async latestAll(): Promise<ReadingResponse[]> {
    const rows = await this.relational.select({ deviceId: sensors.deviceId }).from(sensors);
    if (rows.length === 0) return [];
    const cached = await this.redis.mget(rows.map((r) => LATEST_KEY(r.deviceId)));
    return cached
      .filter((v): v is string => v !== null)
      .map((v) => JSON.parse(v) as ReadingResponse);
  }

  /** Raw time-series readings for a sensor over the last `hours` (default 24, max ~3 days). */
  @Get(':deviceId/readings')
  @ApiOperation({ summary: 'Raw readings for a sensor (last `hours`, default 24, max 72)' })
  async readings(
    @Param('deviceId') deviceId: string,
    @Query('hours') hours?: string,
  ): Promise<Array<typeof readings.$inferSelect>> {
    const windowHours = Math.min(Math.max(Number(hours) || 24, 1), 24 * 3);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    return this.telemetry
      .select()
      .from(readings)
      .where(and(eq(readings.sensorId, deviceId), gte(readings.time, since)))
      .orderBy(desc(readings.time))
      .limit(5000);
  }

  /**
   * Hour-bucketed history from the `readings_hourly` continuous aggregate —
   * cheap to serve over long ranges (default 7 days, max 90). Chronological.
   */
  @Get(':deviceId/history')
  @ApiOperation({ summary: 'Hour-bucketed history (continuous aggregate, last `days`, default 7)' })
  @ApiOkResponse({ type: HourlyBucketDto, isArray: true })
  async history(
    @Param('deviceId') deviceId: string,
    @Query('days') days?: string,
  ): Promise<HourlyBucket[]> {
    const windowDays = Math.min(Math.max(Number(days) || 7, 1), 90);
    const result = await this.telemetry.execute(sql`
      SELECT sensor_id, bucket, avg_pm25, avg_pm10, avg_temperature, avg_humidity, max_aqi, sample_count
      FROM readings_hourly
      WHERE sensor_id = ${deviceId} AND bucket >= now() - make_interval(days => ${windowDays})
      ORDER BY bucket ASC
    `);
    const rows = result as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      sensorId: String(r.sensor_id),
      bucket: new Date(r.bucket as string).toISOString(),
      avgPm25: Number(r.avg_pm25),
      avgPm10: Number(r.avg_pm10),
      avgTemperature: Number(r.avg_temperature),
      avgHumidity: Number(r.avg_humidity),
      maxAqi: Number(r.max_aqi),
      sampleCount: Number(r.sample_count),
    }));
  }

  /** Latest reading for a sensor, served from the Redis cache. */
  @Get(':deviceId/latest')
  @ApiOperation({ summary: 'Latest reading for a sensor (Redis cache)' })
  @ApiOkResponse({ type: ReadingResponseDto })
  async latest(@Param('deviceId') deviceId: string): Promise<ReadingResponse> {
    const cached = await this.redis.get(LATEST_KEY(deviceId));
    if (!cached) throw new NotFoundException(`No readings yet for ${deviceId}`);
    return JSON.parse(cached) as ReadingResponse;
  }
}

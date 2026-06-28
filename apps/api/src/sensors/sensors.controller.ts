import type { ReadingResponse, Sensor } from '@aq/contracts';
import { type RelationalDb, readings, sensors, type TelemetryDb } from '@aq/db';
import { Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { RELATIONAL_DB, TELEMETRY_DB } from '../database/database.module';
import { REDIS } from '../redis/redis.module';

@Controller('sensors')
export class SensorsController {
  constructor(
    @Inject(RELATIONAL_DB) private readonly relational: RelationalDb,
    @Inject(TELEMETRY_DB) private readonly telemetry: TelemetryDb,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
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

  /** Time-series readings for a sensor over the last `hours` (default 24). */
  @Get(':deviceId/readings')
  async readings(
    @Param('deviceId') deviceId: string,
    @Query('hours') hours?: string,
  ): Promise<Array<typeof readings.$inferSelect>> {
    const windowHours = Math.min(Math.max(Number(hours) || 24, 1), 24 * 30);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    return this.telemetry
      .select()
      .from(readings)
      .where(and(eq(readings.sensorId, deviceId), gte(readings.time, since)))
      .orderBy(desc(readings.time))
      .limit(5000);
  }

  /** Latest reading for a sensor, served from the Redis cache. */
  @Get(':deviceId/latest')
  async latest(@Param('deviceId') deviceId: string): Promise<ReadingResponse> {
    const cached = await this.redis.get(`sensor:latest:${deviceId}`);
    if (!cached) throw new NotFoundException(`No readings yet for ${deviceId}`);
    return JSON.parse(cached) as ReadingResponse;
  }
}

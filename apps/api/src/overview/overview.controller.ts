import type { NetworkOverview, ReadingResponse } from '@aq/contracts';
import { type RelationalDb, readings, sensors, type TelemetryDb } from '@aq/db';
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { gte, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { RELATIONAL_DB, TELEMETRY_DB } from '../database/database.module';
import { NetworkOverviewDto } from '../dto';
import { REDIS } from '../redis/redis.module';

const ONLINE_WINDOW_MS = 15 * 60 * 1000;

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
    const sensorRows = await this.relational.select({ deviceId: sensors.deviceId }).from(sensors);
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
}

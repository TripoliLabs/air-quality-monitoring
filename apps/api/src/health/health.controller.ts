import type { RelationalDb, TelemetryDb } from '@aq/db';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { RELATIONAL_DB, TELEMETRY_DB } from '../database/database.module';
import { REDIS } from '../redis/redis.module';

const PROBE_TIMEOUT_MS = 2000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

interface HealthResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  checks: Record<string, string>;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(RELATIONAL_DB) private readonly relational: RelationalDb,
    @Inject(TELEMETRY_DB) private readonly telemetry: TelemetryDb,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness + readiness: probes both DBs and Redis; 503 if any is unreachable. */
  @Get()
  async check(): Promise<HealthResult> {
    const checks: Record<string, string> = {};
    const probe = async (name: string, fn: () => Promise<unknown>): Promise<boolean> => {
      try {
        await withTimeout(fn(), PROBE_TIMEOUT_MS);
        checks[name] = 'ok';
        return true;
      } catch (err) {
        checks[name] = `error: ${String(err)}`;
        return false;
      }
    };

    const results = await Promise.all([
      probe('relationalDb', () => this.relational.execute(sql`select 1`)),
      probe('telemetryDb', () => this.telemetry.execute(sql`select 1`)),
      probe('redis', () => this.redis.ping()),
    ]);

    const body: HealthResult = {
      status: results.every(Boolean) ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
    if (body.status === 'degraded') throw new ServiceUnavailableException(body);
    return body;
  }
}

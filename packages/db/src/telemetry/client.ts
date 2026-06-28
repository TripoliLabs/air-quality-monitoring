import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/** Telemetry DB client (TigerData / TimescaleDB). Connects lazily. */
export function createTelemetryDb(connectionString: string) {
  const sql = postgres(connectionString, { max: 10 });
  return drizzle(sql, { schema });
}

export type TelemetryDb = ReturnType<typeof createTelemetryDb>;
export { schema as telemetrySchema };

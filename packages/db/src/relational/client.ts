import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Relational DB client (DigitalOcean Managed Postgres). postgres.js connects
 * lazily, so creating the client does not require the DB to be reachable.
 */
export function createRelationalDb(connectionString: string) {
  const sql = postgres(connectionString, { max: 10 });
  return drizzle(sql, { schema });
}

export type RelationalDb = ReturnType<typeof createRelationalDb>;
export { schema as relationalSchema };

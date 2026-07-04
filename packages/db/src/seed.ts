/**
 * Seed the relational `sensors` table with the canonical fixtures.
 * Idempotent + updating (ON CONFLICT DO UPDATE), so editing a fixture and
 * re-seeding propagates the change. Run after migrations:
 *   APP_DB_URL=postgres://... node dist/seed.js
 */
import { sql } from 'drizzle-orm';
import { SENSOR_FIXTURES } from './fixtures';
import { createRelationalDb } from './relational/client';
import { sensors } from './relational/schema';

async function main(): Promise<void> {
  const url = process.env.APP_DB_URL;
  if (!url) throw new Error('APP_DB_URL is required to seed');

  const db = createRelationalDb(url);
  const rows = SENSOR_FIXTURES.map((f) => ({
    deviceId: f.deviceId,
    name: f.name,
    latitude: f.latitude,
    longitude: f.longitude,
    neighborhood: f.neighborhood,
    isActive: true,
  }));

  await db
    .insert(sensors)
    .values(rows)
    .onConflictDoUpdate({
      target: sensors.deviceId,
      set: {
        name: sql`excluded.name`,
        latitude: sql`excluded.latitude`,
        longitude: sql`excluded.longitude`,
        neighborhood: sql`excluded.neighborhood`,
        isActive: sql`excluded.is_active`,
        updatedAt: sql`now()`,
      },
    });
  // eslint-disable-next-line no-console
  console.log(`Seeded ${rows.length} sensors.`);
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});

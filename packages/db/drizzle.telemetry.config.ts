import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/telemetry/schema.ts',
  out: './migrations/telemetry',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.TSDB_URL ?? '' },
});

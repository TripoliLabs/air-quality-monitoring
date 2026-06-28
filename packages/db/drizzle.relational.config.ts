import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/relational/schema.ts',
  out: './migrations/relational',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.APP_DB_URL ?? '' },
});

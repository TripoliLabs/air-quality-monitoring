import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Relational app data — lives on DigitalOcean Managed Postgres. */

export const sensors = pgTable('sensors', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: text('device_id').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  neighborhood: text('neighborhood'),
  isActive: boolean('is_active').notNull().default(true),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  batteryMv: integer('battery_mv'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Sensor = typeof sensors.$inferSelect;
export type NewSensor = typeof sensors.$inferInsert;

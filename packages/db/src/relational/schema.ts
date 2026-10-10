import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Relational app data — lives on self-hosted PostgreSQL (see deployment-and-strategy.md). */

export const sensorStatusEnum = ['active', 'maintenance', 'retired'] as const;
export type SensorStatus = (typeof sensorStatusEnum)[number];

export const sensors = pgTable('sensors', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: text('device_id').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  neighborhood: text('neighborhood'),
  status: text('status', { enum: sensorStatusEnum }).notNull().default('active'),
  isActive: boolean('is_active').notNull().default(true),
  installedAt: timestamp('installed_at', { withTimezone: true }),
  isSimulated: boolean('is_simulated').notNull().default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  batteryMv: integer('battery_mv'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Sensor = typeof sensors.$inferSelect;
export type NewSensor = typeof sensors.$inferInsert;

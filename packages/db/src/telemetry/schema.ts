import {
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Time-series telemetry — lives on TigerData (managed TimescaleDB).
 *
 * `readings` is converted into a hypertable via a `--custom` SQL migration
 * (`SELECT create_hypertable('readings', 'time')`). TimescaleDB requires the
 * partitioning column (`time`) to be part of any primary key, hence the
 * composite PK below.
 */
export const readings = pgTable(
  'readings',
  {
    time: timestamp('time', { withTimezone: true }).notNull(),
    sensorId: text('sensor_id').notNull(),
    pm25: doublePrecision('pm25').notNull(),
    pm10: doublePrecision('pm10').notNull(),
    temperature: doublePrecision('temperature').notNull(),
    humidity: doublePrecision('humidity').notNull(),
    pressure: doublePrecision('pressure'),
    aqi: integer('aqi').notNull(),
    aqiCategory: text('aqi_category'),
    batteryMv: integer('battery_mv'),
    signalStrength: integer('signal_strength'),
  },
  (t) => [primaryKey({ columns: [t.sensorId, t.time] })],
);

export type Reading = typeof readings.$inferSelect;
export type NewReading = typeof readings.$inferInsert;

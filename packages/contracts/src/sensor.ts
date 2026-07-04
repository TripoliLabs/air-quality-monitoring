import { z } from 'zod';

/** A single decoded sensor measurement (post-validation, pre-persistence). */
export const SensorReadingSchema = z.object({
  deviceId: z.string().min(1),
  timestamp: z.iso.datetime(),
  // Ceiling is the codec's wire max (6553.5 µg/m³), not a health cap — a 1000
  // limit would drop the extreme dust-storm readings the network exists to record.
  pm25: z.number().min(0).max(6553.5),
  pm10: z.number().min(0).max(6553.5),
  pm1: z.number().min(0).max(6553.5).optional(),
  temperature: z.number().min(-40).max(85),
  humidity: z.number().min(0).max(100),
  pressure: z.number().min(300).max(1100).optional(),
  batteryMv: z.number().int().optional(),
  signalStrength: z.number().int().optional(),
});
export type SensorReading = z.infer<typeof SensorReadingSchema>;

/** API response shape for a persisted reading (includes computed AQI). */
export const ReadingResponseSchema = SensorReadingSchema.extend({
  id: z.string(),
  sensorId: z.string(),
  aqi: z.number().int(),
  aqiCategory: z.string(),
});
export type ReadingResponse = z.infer<typeof ReadingResponseSchema>;

/** One hour-bucketed point from the `readings_hourly` continuous aggregate. */
export const HourlyBucketSchema = z.object({
  sensorId: z.string(),
  bucket: z.string(), // ISO timestamp (hour bucket)
  avgPm25: z.number(),
  avgPm10: z.number(),
  avgTemperature: z.number(),
  avgHumidity: z.number(),
  maxAqi: z.number().int(),
  sampleCount: z.number().int(),
});
export type HourlyBucket = z.infer<typeof HourlyBucketSchema>;

/** Network-wide snapshot for the dashboard overview/stats bar. */
export const NetworkOverviewSchema = z.object({
  sensorsTotal: z.number().int(),
  sensorsOnline: z.number().int(),
  readingsLastHour: z.number().int(),
  avgAqi: z.number().nullable(),
  maxAqi: z.number().int().nullable(),
  byCategory: z.record(z.string(), z.number().int()),
  updatedAt: z.string(),
});
export type NetworkOverview = z.infer<typeof NetworkOverviewSchema>;

/** Public sensor metadata (relational DB). */
export const SensorSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  neighborhood: z.string().optional(),
  isActive: z.boolean(),
});
export type Sensor = z.infer<typeof SensorSchema>;

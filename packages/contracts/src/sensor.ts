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

/** Allowed sensor operational statuses */
export const SensorStatusSchema = z.enum(['active', 'maintenance', 'retired']);
export type SensorStatus = z.infer<typeof SensorStatusSchema>;

/** Payload for registering a new sensor in the registry */
export const CreateSensorSchema = z.object({
  deviceId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{16}$/, 'DevEUI must be a 16-character hexadecimal string')
    .transform((val) => val.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  neighborhood: z.string().trim().min(1).max(100).optional(),
  status: SensorStatusSchema.default('active'),
  installedAt: z.iso.datetime().optional(),
  isSimulated: z.boolean().default(false),
});
export type CreateSensor = z.infer<typeof CreateSensorSchema>;

/** Payload for updating an existing sensor */
export const UpdateSensorSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  neighborhood: z.string().trim().min(1).max(100).nullable().optional(),
  status: SensorStatusSchema.optional(),
  installedAt: z.iso.datetime().nullable().optional(),
  isSimulated: z.boolean().optional(),
});
export type UpdateSensor = z.infer<typeof UpdateSensorSchema>;

/** Public sensor metadata (relational DB). */
export const SensorSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  neighborhood: z.string().optional(),
  status: SensorStatusSchema,
  isActive: z.boolean(),
  installedAt: z.string().optional(),
  isSimulated: z.boolean(),
  lastSeenAt: z.string().optional(),
  batteryMv: z.number().int().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Sensor = z.infer<typeof SensorSchema>;

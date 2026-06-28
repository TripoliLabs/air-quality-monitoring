import { z } from 'zod';

/** A single decoded sensor measurement (post-validation, pre-persistence). */
export const SensorReadingSchema = z.object({
  deviceId: z.string().min(1),
  timestamp: z.iso.datetime(),
  pm25: z.number().min(0).max(1000),
  pm10: z.number().min(0).max(1000),
  pm1: z.number().min(0).max(1000).optional(),
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

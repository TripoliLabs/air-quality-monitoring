/**
 * The dashboard's own view types. Every data source (live API, local mock)
 * maps into these, so nothing above the service layer knows where data came from.
 */

export interface Sensor {
  /** Device identifier (DevEUI on the live network). Readings are keyed by it. */
  id: string;
  name: string;
  /** Arabic name when the source has one; the UI falls back to `name`. */
  nameAr?: string;
  /** Neighbourhood as the source spells it, or null when unassigned. */
  neighborhood: string | null;
  neighborhoodAr?: string;
  /** URL-safe key derived from `neighborhood`. */
  neighborhoodId: string;
  latitude: number;
  longitude: number;
  /** Administrative flag: false means the sensor is retired or in maintenance. */
  isActive: boolean;
  installDate?: string;
}

export interface Reading {
  sensorId: string;
  /** Epoch milliseconds. */
  time: number;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  pressure?: number;
  aqi: number;
  batteryMv?: number;
  signalStrength?: number;
}

/** One hour-bucketed aggregate for a sensor. */
export interface HourlyPoint {
  sensorId: string;
  /** Epoch milliseconds of the start of the hour. */
  time: number;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  maxAqi: number;
  samples: number;
}

/** One hour of the whole network, or of one neighbourhood. */
export interface NetworkHourlyPoint {
  /** Epoch milliseconds of the start of the hour. */
  time: number;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  maxAqi: number;
  /** Sensors that reported in the hour. */
  sensors: number;
}

/** Derived from `isActive` and how recently the sensor reported. */
export type SensorStatus = 'online' | 'offline' | 'inactive';

/** How fresh the data on screen is. */
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'polling';

export type DataSourceKind = 'api' | 'mock';

export type Locale = 'en' | 'ar';
export type Theme = 'light' | 'dark';

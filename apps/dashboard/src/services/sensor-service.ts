import type { DataSourceKind, HourlyPoint, Reading, Sensor } from '../types';

export interface RealtimeHandlers {
  /** A sensor reported. */
  onReading: (reading: Reading) => void;
  /** The live channel connected (true) or dropped (false). */
  onConnection: (connected: boolean) => void;
}

/**
 * The boundary between the dashboard and its data. The store depends only on
 * this interface; the live API and the local mock both implement it, and both
 * return the dashboard's own types.
 */
export interface SensorService {
  readonly kind: DataSourceKind;
  /** Every sensor with its metadata. */
  getSensors(): Promise<Sensor[]>;
  /** The most recent reading of every sensor that has one. */
  getLatest(): Promise<Reading[]>;
  /** Raw readings for one sensor over the last `hours`, oldest first. */
  getReadings(sensorId: string, hours: number): Promise<Reading[]>;
  /** Hourly aggregates for one sensor over the last `days`, oldest first. */
  getHourly(sensorId: string, days: number): Promise<HourlyPoint[]>;
  /** Stream live readings. Returns a function that stops the stream. */
  subscribe(handlers: RealtimeHandlers): () => void;
}

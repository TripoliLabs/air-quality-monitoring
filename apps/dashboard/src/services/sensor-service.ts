import type { SensorDefinition } from '@mock/sensors';
import type { SensorReading } from '@mock/simulator';

export type { SensorDefinition, SensorReading };

/**
 * The boundary between the dashboard and its data source. The store depends only
 * on this interface; implementations are the live backend (HTTP + WebSocket) or
 * the in-browser mock simulator. Returns the dashboard's own view types.
 */
export interface SensorService {
  /** All sensors with their metadata. */
  getSensors(): Promise<SensorDefinition[]>;
  /** Historical readings for one sensor, chronological (oldest → newest). */
  getHistory(deviceId: string, hours?: number): Promise<SensorReading[]>;
  /** Subscribe to live readings. Returns an unsubscribe function. */
  subscribe(onReading: (reading: SensorReading) => void): () => void;
  /** Release resources. */
  dispose(): void;
}

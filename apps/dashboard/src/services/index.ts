import { HttpSensorService } from './http-sensor-service';
import { MockSensorService } from './mock-sensor-service';
import type { SensorService } from './sensor-service';

export type { SensorService } from './sensor-service';

/**
 * Selects the data source: the live backend when VITE_API_URL is configured,
 * otherwise the in-browser mock simulator.
 */
export function createSensorService(): SensorService {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl ? new HttpSensorService(apiUrl) : new MockSensorService();
}

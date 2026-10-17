import { config } from '../lib/config';
import { HttpSensorService } from './http-sensor-service';
import type { SensorService } from './sensor-service';

export type { RealtimeHandlers, SensorService } from './sensor-service';

/**
 * Builds the data source chosen in lib/config.ts.
 *
 * The mock is loaded with a dynamic import behind `import.meta.env.DEV`, which
 * Vite replaces with `false` in a production build. The branch is then dead
 * code and the whole mock module is left out of the bundle, so a deployed
 * dashboard cannot show simulated data.
 */
export async function createSensorService(): Promise<SensorService> {
  if (import.meta.env.DEV && config.source === 'mock') {
    const { MockSensorService } = await import('../mock/mock-sensor-service');
    return new MockSensorService();
  }
  return new HttpSensorService(config.apiBase, config.socketUrl);
}

import { SENSORS, type SensorDefinition } from '@mock/sensors';
import { AirQualitySimulator, type SensorReading } from '@mock/simulator';
import type { SensorService } from './sensor-service';

/** In-browser implementation backed by the original simulator (no backend needed). */
export class MockSensorService implements SensorService {
  private readonly sim = new AirQualitySimulator();
  private started = false;

  async getSensors(): Promise<SensorDefinition[]> {
    return SENSORS;
  }

  async getHistory(deviceId: string): Promise<SensorReading[]> {
    return this.sim.getHistory(deviceId);
  }

  subscribe(onReading: (reading: SensorReading) => void): () => void {
    const handler = (readings: SensorReading[]): void => readings.forEach(onReading);
    this.sim.onUpdate(handler);
    if (!this.started) {
      this.sim.start(4000);
      this.started = true;
    }
    return () => this.sim.stop();
  }

  dispose(): void {
    this.sim.stop();
  }
}

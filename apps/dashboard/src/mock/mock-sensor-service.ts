import type { RealtimeHandlers, SensorService } from '../services/sensor-service';
import type { HourlyPoint, NetworkHourlyPoint, Reading, Sensor } from '../types';
import { hourlyHistory, lastReportTime, rawHistory, readingAt } from './model';
import { MOCK_SENSORS, type MockSensor } from './sensors';

const TICK_MS = 2500;

function toSensor(mock: MockSensor): Sensor {
  const { basePm25: _base, seed: _seed, silentForMs: _quiet, ...sensor } = mock;
  return sensor;
}

/**
 * In-browser data source for local development: no backend needed. Sensors
 * report a few at a time, the way uplinks trickle in on the real network.
 * Loaded only in development (see services/index.ts).
 */
export class MockSensorService implements SensorService {
  readonly kind = 'mock' as const;

  private find(sensorId: string): MockSensor | undefined {
    return MOCK_SENSORS.find((s) => s.id === sensorId);
  }

  async getSensors(): Promise<Sensor[]> {
    return MOCK_SENSORS.map(toSensor);
  }

  async getLatest(): Promise<Reading[]> {
    const now = Date.now();
    return MOCK_SENSORS.map((s) => readingAt(s, lastReportTime(s, now)));
  }

  async getReadings(sensorId: string, hours: number): Promise<Reading[]> {
    const sensor = this.find(sensorId);
    return sensor ? rawHistory(sensor, hours, Date.now()) : [];
  }

  async getHourly(sensorId: string, days: number): Promise<HourlyPoint[]> {
    const sensor = this.find(sensorId);
    return sensor ? hourlyHistory(sensor, days, Date.now()) : [];
  }

  async getNetworkHourly(days: number, neighborhood?: string): Promise<NetworkHourlyPoint[]> {
    const now = Date.now();
    const hours = new Map<number, HourlyPoint[]>();
    for (const sensor of MOCK_SENSORS) {
      if (neighborhood && sensor.neighborhood !== neighborhood) continue;
      for (const point of hourlyHistory(sensor, days, now)) {
        const group = hours.get(point.time);
        if (group) group.push(point);
        else hours.set(point.time, [point]);
      }
    }
    return [...hours.entries()]
      .sort(([a], [b]) => a - b)
      .map(([time, points]) => {
        const mean = (pick: (p: HourlyPoint) => number): number =>
          points.reduce((sum, p) => sum + pick(p), 0) / points.length;
        return {
          time,
          pm25: mean((p) => p.pm25),
          pm10: mean((p) => p.pm10),
          temperature: mean((p) => p.temperature),
          humidity: mean((p) => p.humidity),
          maxAqi: Math.max(...points.map((p) => p.maxAqi)),
          sensors: points.length,
        };
      });
  }

  subscribe({ onReading, onConnection }: RealtimeHandlers): () => void {
    const reporting = MOCK_SENSORS.filter((s) => s.silentForMs === undefined);
    const connect = setTimeout(() => onConnection(true), 300);
    const timer = setInterval(() => {
      const count = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const sensor = reporting[Math.floor(Math.random() * reporting.length)];
        onReading(readingAt(sensor, Date.now()));
      }
    }, TICK_MS);
    return () => {
      clearTimeout(connect);
      clearInterval(timer);
    };
  }
}

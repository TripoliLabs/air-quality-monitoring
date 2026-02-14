/**
 * Live simulation engine for air quality data
 * Generates realistic sensor readings with random walk behavior
 */

import { SENSORS } from './sensors';

export interface SensorReading {
  sensorId: string;
  timestamp: Date;
  pm2_5: number;
  pm10: number;
  temperature: number;
  humidity: number;
  batteryMv: number;
  signalStrength: number;
  aqi: number;
}

type UpdateCallback = (readings: SensorReading[]) => void;

/** EPA AQI breakpoints for PM2.5 */
const PM25_BREAKPOINTS = [
  { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
  { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
];

export function calculateAQI(pm25: number): number {
  const c = Math.max(0, pm25);
  for (const bp of PM25_BREAKPOINTS) {
    if (c <= bp.cHigh) {
      return Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) + bp.iLow);
    }
  }
  return 500;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomWalk(prev: number, stepSize: number, min: number, max: number): number {
  const delta = (Math.random() - 0.5) * 2 * stepSize;
  return clamp(prev + delta, min, max);
}

export class AirQualitySimulator {
  private history: Map<string, SensorReading[]> = new Map();
  private lastReadings: Map<string, SensorReading> = new Map();
  private subscribers: UpdateCallback[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.generateHistory();
  }

  private generateHistory(): void {
    const now = new Date();
    const readingsPerSensor = 288; // 24h * 60min / 5min

    for (const sensor of SENSORS) {
      const readings: SensorReading[] = [];
      const basePm25 = (sensor.basePm25.min + sensor.basePm25.max) / 2;

      let pm25 = basePm25 + (Math.random() - 0.5) * 20;
      let pm10 = pm25 * 1.6 + Math.random() * 10;
      let temp = 18 + Math.random() * 10;
      let humidity = 45 + Math.random() * 30;
      let battery = 3600 + Math.random() * 600;

      for (let i = readingsPerSensor - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);

        // Time-of-day effect: higher pollution during morning/evening rush
        const hour = timestamp.getHours();
        const rushMultiplier = this.getRushMultiplier(hour);

        pm25 = randomWalk(pm25, 2 * rushMultiplier, sensor.basePm25.min, sensor.basePm25.max);
        pm10 = randomWalk(pm10, 3, pm25 * 1.2, pm25 * 2.0);
        temp = randomWalk(temp, 0.3, 10, 38);
        humidity = randomWalk(humidity, 1, 25, 85);
        battery = randomWalk(battery, 5, 3200, 4200);

        const reading: SensorReading = {
          sensorId: sensor.id,
          timestamp,
          pm2_5: Math.round(pm25 * 10) / 10,
          pm10: Math.round(pm10 * 10) / 10,
          temperature: Math.round(temp * 10) / 10,
          humidity: Math.round(humidity * 10) / 10,
          batteryMv: Math.round(battery),
          signalStrength: Math.round(-40 - Math.random() * 50),
          aqi: calculateAQI(pm25),
        };

        readings.push(reading);
      }

      this.history.set(sensor.id, readings);
      this.lastReadings.set(sensor.id, readings[readings.length - 1]);
    }
  }

  private getRushMultiplier(hour: number): number {
    // Morning rush: 7-9, Evening rush: 17-20
    if (hour >= 7 && hour <= 9) return 1.5;
    if (hour >= 17 && hour <= 20) return 1.4;
    if (hour >= 0 && hour <= 5) return 0.6;
    return 1.0;
  }

  private generateNewReadings(): SensorReading[] {
    const now = new Date();
    const hour = now.getHours();
    const rushMultiplier = this.getRushMultiplier(hour);
    const newReadings: SensorReading[] = [];

    for (const sensor of SENSORS) {
      const prev = this.lastReadings.get(sensor.id);
      if (!prev) continue;

      const pm25 = randomWalk(prev.pm2_5, 1.5 * rushMultiplier, sensor.basePm25.min, sensor.basePm25.max);
      const pm10 = randomWalk(prev.pm10, 2, pm25 * 1.2, pm25 * 2.0);

      const reading: SensorReading = {
        sensorId: sensor.id,
        timestamp: now,
        pm2_5: Math.round(pm25 * 10) / 10,
        pm10: Math.round(pm10 * 10) / 10,
        temperature: randomWalk(prev.temperature, 0.2, 10, 38),
        humidity: randomWalk(prev.humidity, 0.5, 25, 85),
        batteryMv: Math.round(randomWalk(prev.batteryMv, 3, 3200, 4200)),
        signalStrength: Math.round(-40 - Math.random() * 50),
        aqi: calculateAQI(pm25),
      };
      reading.temperature = Math.round(reading.temperature * 10) / 10;
      reading.humidity = Math.round(reading.humidity * 10) / 10;

      newReadings.push(reading);
      this.lastReadings.set(sensor.id, reading);

      // Append to history, cap at 288
      const hist = this.history.get(sensor.id) ?? [];
      hist.push(reading);
      if (hist.length > 288) hist.shift();
      this.history.set(sensor.id, hist);
    }

    return newReadings;
  }

  start(intervalMs = 4000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      const readings = this.generateNewReadings();
      for (const cb of this.subscribers) {
        cb(readings);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onUpdate(callback: UpdateCallback): void {
    this.subscribers.push(callback);
  }

  removeCallback(callback: UpdateCallback): void {
    this.subscribers = this.subscribers.filter((cb) => cb !== callback);
  }

  getHistory(sensorId: string): SensorReading[] {
    return this.history.get(sensorId) ?? [];
  }

  getLatest(sensorId: string): SensorReading | undefined {
    return this.lastReadings.get(sensorId);
  }

  getAllLatest(): SensorReading[] {
    return Array.from(this.lastReadings.values());
  }
}

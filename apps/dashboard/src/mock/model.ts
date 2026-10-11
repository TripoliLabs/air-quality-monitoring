/**
 * A deterministic model of Tripoli's air for the mock: the reading of any
 * sensor at any moment is a pure function of the sensor and the time. Raw
 * readings, hourly aggregates and the live stream are all sampled from it, so
 * they agree with each other and survive a reload.
 */

import { pm25ToAqi } from '../lib/aqi';
import type { HourlyPoint, Reading } from '../types';
import { type MockSensor, seeded } from './sensors';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export const SAMPLE_MS = 5 * MINUTE;

/** Traffic peaks morning and evening; diesel generators lift the evening further. */
function diurnal(hour: number): number {
  const bump = (centre: number, width: number, height: number): number =>
    height * Math.exp(-((hour - centre) ** 2) / (2 * width ** 2));
  return 0.72 + bump(8, 1.6, 0.45) + bump(19.5, 2.4, 0.7) + bump(23.5, 1.5, 0.2);
}

/** Smooth noise: interpolates between seeded values at fixed steps of `period`. */
function noise(t: number, period: number, salt: number): number {
  const x = t / period;
  const i = Math.floor(x);
  const f = x - i;
  const ease = f * f * (3 - 2 * f);
  return seeded(i + salt) * (1 - ease) + seeded(i + 1 + salt) * ease;
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

export function readingAt(sensor: MockSensor, time: number): Reading {
  const date = new Date(time);
  const hour = date.getHours() + date.getMinutes() / 60;
  const salt = sensor.seed * 10_000;

  // Some days are simply dirtier than others (weather, dust from the east).
  const dayFactor = 0.7 + noise(time, DAY, 31) * 0.75;
  const local = 0.82 + noise(time, 40 * MINUTE, salt) * 0.36;
  const pm25 = Math.max(2, sensor.basePm25 * diurnal(hour) * dayFactor * local);
  const pm10 = pm25 * (1.45 + noise(time, 3 * HOUR, salt + 7) * 0.5);

  const dayCurve = Math.sin(((hour - 9) / 24) * 2 * Math.PI);
  const temperature = 21 + dayCurve * 5 + noise(time, DAY, 77) * 5 + sensor.seed * 1.5;
  const humidity = 62 - dayCurve * 14 + noise(time, 5 * HOUR, salt + 3) * 12;

  return {
    sensorId: sensor.id,
    time,
    pm25: round1(pm25),
    pm10: round1(pm10),
    temperature: round1(temperature),
    humidity: round1(Math.min(98, Math.max(20, humidity))),
    pressure: Math.round(1012 + noise(time, DAY, 5) * 8),
    aqi: pm25ToAqi(pm25),
    batteryMv: Math.round(3550 + sensor.seed * 450 + Math.max(0, dayCurve) * 180),
    signalStrength: Math.round(-62 - sensor.seed * 45 - noise(time, HOUR, salt + 11) * 8),
  };
}

/** When the sensor last reported: now, or earlier if it has gone quiet. */
export function lastReportTime(sensor: MockSensor, now: number): number {
  return now - (sensor.silentForMs ?? 0);
}

export function rawHistory(sensor: MockSensor, hours: number, now: number): Reading[] {
  const end = lastReportTime(sensor, now);
  const start = now - hours * HOUR;
  const readings: Reading[] = [];
  for (let t = Math.ceil(start / SAMPLE_MS) * SAMPLE_MS; t <= end; t += SAMPLE_MS) {
    readings.push(readingAt(sensor, t));
  }
  return readings;
}

export function hourlyHistory(sensor: MockSensor, days: number, now: number): HourlyPoint[] {
  const end = lastReportTime(sensor, now);
  const start = Math.floor((now - days * DAY) / HOUR) * HOUR;
  const points: HourlyPoint[] = [];
  for (let t = start; t <= end; t += HOUR) {
    // Three samples across the hour are enough to stand in for the average.
    const samples = [10, 30, 50].map((minute) => readingAt(sensor, t + minute * MINUTE));
    const mean = (pick: (r: Reading) => number): number =>
      samples.reduce((sum, r) => sum + pick(r), 0) / samples.length;
    points.push({
      sensorId: sensor.id,
      time: t,
      pm25: round1(mean((r) => r.pm25)),
      pm10: round1(mean((r) => r.pm10)),
      temperature: round1(mean((r) => r.temperature)),
      humidity: round1(mean((r) => r.humidity)),
      maxAqi: Math.max(...samples.map((r) => r.aqi)),
      samples: 12,
    });
  }
  return points;
}

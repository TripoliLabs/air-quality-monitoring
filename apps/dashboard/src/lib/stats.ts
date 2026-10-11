/**
 * Pure aggregation over readings: no Vue, no I/O, so it is easy to test and to
 * reuse from any view.
 */

import type { NetworkHourlyPoint, Reading, Sensor, SensorStatus } from '../types';
import { pm25ToAqi } from './aqi';

/** A sensor counts as online if it reported within this window (matches the API). */
export const ONLINE_WINDOW_MS = 15 * 60_000;

export interface SensorRow {
  sensor: Sensor;
  reading: Reading | null;
  status: SensorStatus;
}

export function sensorStatus(sensor: Sensor, reading: Reading | null, now: number): SensorStatus {
  if (!sensor.isActive) return 'inactive';
  return reading && now - reading.time < ONLINE_WINDOW_MS ? 'online' : 'offline';
}

export interface AirSummary {
  /** Mean AQI of the sensors currently reporting; null when none are. */
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  temperature: number | null;
  humidity: number | null;
  total: number;
  online: number;
  /** Most recent reading time among the group. */
  updatedAt: number | null;
}

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** Averages over the rows that are online; stale readings are never averaged in. */
export function summarise(rows: SensorRow[]): AirSummary {
  const live = rows
    .filter((row): row is SensorRow & { reading: Reading } => row.status === 'online')
    .map((row) => row.reading);
  const aqi = mean(live.map((r) => r.aqi));
  const times = rows.flatMap((row) => (row.reading ? [row.reading.time] : []));
  return {
    aqi: aqi === null ? null : Math.round(aqi),
    pm25: mean(live.map((r) => r.pm25)),
    pm10: mean(live.map((r) => r.pm10)),
    temperature: mean(live.map((r) => r.temperature)),
    humidity: mean(live.map((r) => r.humidity)),
    total: rows.length,
    online: live.length,
    updatedAt: times.length ? Math.max(...times) : null,
  };
}

export interface NeighborhoodSummary extends AirSummary {
  id: string;
  name: string;
  nameAr?: string;
  rows: SensorRow[];
  latitude: number;
  longitude: number;
}

/** Groups rows by neighbourhood. Sensors without one are left out. */
export function groupByNeighborhood(rows: SensorRow[]): NeighborhoodSummary[] {
  const groups = new Map<string, SensorRow[]>();
  for (const row of rows) {
    if (!row.sensor.neighborhood) continue;
    const group = groups.get(row.sensor.neighborhoodId);
    if (group) group.push(row);
    else groups.set(row.sensor.neighborhoodId, [row]);
  }
  return [...groups.entries()].map(([id, members]) => {
    const first = members[0].sensor;
    return {
      ...summarise(members),
      id,
      name: first.neighborhood ?? id,
      nameAr: first.neighborhoodAr,
      rows: members,
      latitude: members.reduce((sum, m) => sum + m.sensor.latitude, 0) / members.length,
      longitude: members.reduce((sum, m) => sum + m.sensor.longitude, 0) / members.length,
    };
  });
}

export interface SeriesPoint {
  time: number;
  pm25: number;
  aqi: number;
  /** How many sensors contributed to the point. */
  sensors: number;
}

/** Network hourly averages as an AQI series, from `since` onwards. */
export function toSeries(points: NetworkHourlyPoint[], since = 0): SeriesPoint[] {
  return points
    .filter((point) => point.time >= since)
    .map((point) => ({
      time: point.time,
      pm25: point.pm25,
      aqi: pm25ToAqi(point.pm25),
      sensors: point.sensors,
    }));
}

export interface HourOfDay {
  hour: number;
  pm25: number | null;
  aqi: number | null;
}

/** The typical day: mean PM2.5 for each hour of the clock, in local time. */
export function hourOfDayProfile(series: SeriesPoint[]): HourOfDay[] {
  const byHour: number[][] = Array.from({ length: 24 }, () => []);
  for (const point of series) byHour[new Date(point.time).getHours()].push(point.pm25);
  return byHour.map((values, hour) => {
    const pm25 = mean(values);
    return { hour, pm25, aqi: pm25 === null ? null : pm25ToAqi(pm25) };
  });
}

/** Share of hours spent in each AQI level (1–6), as counts. */
export function levelCounts(series: SeriesPoint[], levelOf: (aqi: number) => number): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const point of series) counts[levelOf(point.aqi) - 1]++;
  return counts;
}

/** Runs `task` over `items`, at most `limit` at a time. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

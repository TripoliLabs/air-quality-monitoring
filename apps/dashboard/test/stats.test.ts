import { describe, expect, it } from 'vitest';
import {
  groupByNeighborhood,
  hourOfDayProfile,
  mapLimit,
  ONLINE_WINDOW_MS,
  type SensorRow,
  sensorStatus,
  summarise,
  toSeries,
} from '../src/lib/stats';
import type { NetworkHourlyPoint, Reading, Sensor } from '../src/types';

const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const HOUR = 3_600_000;

const sensor = (id: string, neighborhood: string | null = 'Mina', isActive = true): Sensor => ({
  id,
  name: id,
  neighborhood,
  neighborhoodId: neighborhood ? neighborhood.toLowerCase() : 'unassigned',
  latitude: 34.44,
  longitude: 35.83,
  isActive,
});

const reading = (sensorId: string, aqi: number, ageMs = 0): Reading => ({
  sensorId,
  time: NOW - ageMs,
  pm25: aqi / 4,
  pm10: aqi / 2,
  temperature: 20,
  humidity: 50,
  aqi,
});

const row = (s: Sensor, r: Reading | null): SensorRow => ({
  sensor: s,
  reading: r,
  status: sensorStatus(s, r, NOW),
});

describe('sensorStatus', () => {
  it('is online only while readings are recent', () => {
    const s = sensor('a');
    expect(sensorStatus(s, reading('a', 40, ONLINE_WINDOW_MS - 1000), NOW)).toBe('online');
    expect(sensorStatus(s, reading('a', 40, ONLINE_WINDOW_MS + 1000), NOW)).toBe('offline');
    expect(sensorStatus(s, null, NOW)).toBe('offline');
  });

  it('is inactive when the sensor is retired, even if it still reports', () => {
    expect(sensorStatus(sensor('a', 'Mina', false), reading('a', 40), NOW)).toBe('inactive');
  });
});

describe('summarise', () => {
  it('averages only the sensors reporting now', () => {
    const rows = [
      row(sensor('a'), reading('a', 40)),
      row(sensor('b'), reading('b', 80)),
      row(sensor('stale'), reading('stale', 400, 2 * HOUR)),
      row(sensor('retired', 'Mina', false), reading('retired', 400)),
      row(sensor('silent'), null),
    ];
    const summary = summarise(rows);
    expect(summary.aqi).toBe(60);
    expect(summary.online).toBe(2);
    expect(summary.total).toBe(5);
    expect(summary.updatedAt).toBe(NOW);
  });

  it('has no average when nothing is reporting', () => {
    const summary = summarise([row(sensor('a'), null)]);
    expect(summary.aqi).toBeNull();
    expect(summary.pm25).toBeNull();
    expect(summary.updatedAt).toBeNull();
  });
});

describe('groupByNeighborhood', () => {
  it('groups by place and leaves out sensors without one', () => {
    const groups = groupByNeighborhood([
      row(sensor('a', 'Mina'), reading('a', 40)),
      row(sensor('b', 'Mina'), reading('b', 60)),
      row(sensor('c', 'Tell'), reading('c', 120)),
      row(sensor('d', null), reading('d', 300)),
    ]);
    expect(groups.map((g) => [g.id, g.total, g.aqi])).toEqual([
      ['mina', 2, 50],
      ['tell', 1, 120],
    ]);
  });
});

describe('network history', () => {
  const point = (hoursAgo: number, pm25: number, sensors = 3): NetworkHourlyPoint => ({
    time: NOW - hoursAgo * HOUR,
    pm25,
    pm10: pm25 * 2,
    temperature: 20,
    humidity: 50,
    maxAqi: 0,
    sensors,
  });
  const points = [point(30, 500), point(2, 9), point(1, 35.4, 2)];

  it('turns hourly averages into an AQI series within the window', () => {
    expect(toSeries(points, NOW - 24 * HOUR).map((p) => [p.pm25, p.aqi, p.sensors])).toEqual([
      [9, 50, 3],
      [35.4, 100, 2],
    ]);
    expect(toSeries(points)).toHaveLength(3);
  });

  it('builds a 24-slot typical day with gaps where there is no data', () => {
    const profile = hourOfDayProfile(toSeries(points, NOW - 24 * HOUR));
    expect(profile).toHaveLength(24);
    expect(profile.filter((slot) => slot.pm25 !== null)).toHaveLength(2);
  });
});

describe('mapLimit', () => {
  it('keeps order and never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running--;
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});

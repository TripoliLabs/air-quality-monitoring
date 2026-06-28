/**
 * API integration test. Runs against a LIVE stack (`docker compose up -d`),
 * exercising the real NestJS app, TimescaleDB, relational DB and Redis.
 *   pnpm --filter @aq/api test:integration
 */
import { beforeAll, describe, expect, it } from 'vitest';

const API = process.env.API_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${API}${path}`);
}

describe('API integration', () => {
  beforeAll(async () => {
    // Fail fast with a clear message if the stack isn't running.
    try {
      await get('/health');
    } catch {
      throw new Error(`API not reachable at ${API} — start the stack: docker compose up -d`);
    }
  });

  it('GET /health is ok', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });

  it('GET /sensors returns the seeded sensors with metadata', async () => {
    const res = await get('/sensors');
    expect(res.status).toBe(200);
    const sensors = (await res.json()) as Array<Record<string, unknown>>;
    expect(sensors.length).toBeGreaterThanOrEqual(6);
    expect(sensors[0]).toMatchObject({
      deviceId: expect.any(String),
      name: expect.any(String),
      neighborhood: expect.any(String),
    });
  });

  it('GET /sensors/:id/readings returns time-series for a sensor', async () => {
    const sensors = (await (await get('/sensors')).json()) as Array<{ deviceId: string }>;
    const id = sensors[0].deviceId;
    const readings = (await (await get(`/sensors/${id}/readings?hours=24`)).json()) as Array<
      Record<string, unknown>
    >;
    expect(Array.isArray(readings)).toBe(true);
    if (readings.length > 0) {
      expect(readings[0]).toMatchObject({ sensorId: id, aqi: expect.any(Number) });
      // ordered newest-first
      const t0 = new Date(readings[0].time as string).getTime();
      const t1 = new Date(readings[Math.min(1, readings.length - 1)].time as string).getTime();
      expect(t0).toBeGreaterThanOrEqual(t1);
    }
  });

  it('GET /sensors/:id/latest returns the cached latest reading', async () => {
    const sensors = (await (await get('/sensors')).json()) as Array<{ deviceId: string }>;
    const id = sensors[0].deviceId;
    const res = await get(`/sensors/${id}/latest`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const latest = (await res.json()) as Record<string, unknown>;
      expect(latest).toMatchObject({ sensorId: id, aqi: expect.any(Number), pm25: expect.any(Number) });
    }
  });

  it('GET /sensors/latest returns the bulk latest readings', async () => {
    const res = await get('/sensors/latest');
    expect(res.status).toBe(200);
    const readings = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(readings)).toBe(true);
    // Empty when no data has flowed yet (e.g. the slim CI stack); validate shape otherwise.
    for (const r of readings) {
      expect(r).toMatchObject({
        sensorId: expect.any(String),
        aqi: expect.any(Number),
        pm25: expect.any(Number),
      });
    }
  });

  it('GET /sensors/:id/history returns hour-bucketed aggregates (chronological)', async () => {
    const sensors = (await (await get('/sensors')).json()) as Array<{ deviceId: string }>;
    const id = sensors[0].deviceId;
    const res = await get(`/sensors/${id}/history?days=7`);
    expect(res.status).toBe(200);
    const buckets = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(buckets)).toBe(true);
    if (buckets.length > 0) {
      expect(buckets[0]).toMatchObject({
        sensorId: id,
        bucket: expect.any(String),
        avgPm25: expect.any(Number),
        maxAqi: expect.any(Number),
        sampleCount: expect.any(Number),
      });
      const t0 = new Date(buckets[0].bucket as string).getTime();
      const tN = new Date(buckets[buckets.length - 1].bucket as string).getTime();
      expect(tN).toBeGreaterThanOrEqual(t0); // oldest-first
    }
  });

  it('GET /overview returns a network snapshot', async () => {
    const res = await get('/overview');
    expect(res.status).toBe(200);
    const o = (await res.json()) as Record<string, unknown>;
    expect(o).toMatchObject({
      sensorsTotal: expect.any(Number),
      sensorsOnline: expect.any(Number),
      readingsLastHour: expect.any(Number),
      byCategory: expect.any(Object),
      updatedAt: expect.any(String),
    });
    expect(o.sensorsTotal as number).toBeGreaterThanOrEqual(6);
    expect(o.sensorsOnline as number).toBeLessThanOrEqual(o.sensorsTotal as number);
    expect(['number', 'object']).toContain(typeof o.avgAqi); // number | null
  });
});

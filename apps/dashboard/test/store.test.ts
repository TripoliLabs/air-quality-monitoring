import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeHandlers, SensorService } from '../src/services/sensor-service';
import type { Reading, Sensor } from '../src/types';

const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);

const sensor = (id: string, neighborhood = 'Mina'): Sensor => ({
  id,
  name: id,
  neighborhood,
  neighborhoodId: neighborhood.toLowerCase(),
  latitude: 34.44,
  longitude: 35.83,
  isActive: true,
});

const reading = (sensorId: string, aqi: number, time = NOW): Reading => ({
  sensorId,
  time,
  pm25: aqi / 4,
  pm10: aqi / 2,
  temperature: 20,
  humidity: 50,
  aqi,
});

/** A scriptable data source: tests push readings and flip the connection. */
class FakeService implements SensorService {
  readonly kind = 'api' as const;
  sensors: Sensor[] = [sensor('a'), sensor('b')];
  latest: Reading[] = [reading('a', 40), reading('b', 80)];
  handlers: RealtimeHandlers | null = null;
  getSensors = vi.fn(async () => this.sensors);
  getLatest = vi.fn(async () => this.latest);
  getReadings = vi.fn(async (id: string) => [
    reading(id, 30, NOW - 600_000),
    reading(id, 35, NOW - 300_000),
  ]);
  getHourly = vi.fn(async () => []);
  subscribe = vi.fn((handlers: RealtimeHandlers) => {
    this.handlers = handlers;
    return () => (this.handlers = null);
  });
}

let fake: FakeService;
vi.mock('../src/services', () => ({ createSensorService: async () => fake }));

async function startStore() {
  const { useAirStore } = await import('../src/stores/air');
  const store = useAirStore();
  await store.start();
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // The store only needs these two things from the page.
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  setActivePinia(createPinia());
  fake = new FakeService();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('air store', () => {
  it('loads sensors with their latest readings and summarises the city', async () => {
    const store = await startStore();
    expect(store.ready).toBe(true);
    expect(store.source).toBe('api');
    expect(store.rows).toHaveLength(2);
    expect(store.city.aqi).toBe(60);
    expect(store.city.online).toBe(2);
    expect(store.neighborhoods).toHaveLength(1);
  });

  it('starts only once however many views ask', async () => {
    const store = await startStore();
    await Promise.all([store.start(), store.start()]);
    expect(fake.getSensors).toHaveBeenCalledTimes(1);
    expect(fake.subscribe).toHaveBeenCalledTimes(1);
  });

  it('updates every derived value the moment a live reading arrives', async () => {
    const store = await startStore();
    fake.handlers?.onReading(reading('a', 140, NOW + 1000));
    expect(store.city.aqi).toBe(110);
    expect(store.getRow('a')?.reading?.aqi).toBe(140);
    expect(store.neighborhoods[0].aqi).toBe(110);
    expect(store.lastLive?.sensorId).toBe('a');
  });

  it('ignores a reading older than the one it already has', async () => {
    const store = await startStore();
    fake.handlers?.onReading(reading('a', 300, NOW - 60_000));
    expect(store.getRow('a')?.reading?.aqi).toBe(40);
  });

  it('appends live readings to a history that is open', async () => {
    const store = await startStore();
    await store.loadReadings('a', 24);
    expect(store.rawHistory.a.readings).toHaveLength(2);
    fake.handlers?.onReading(reading('a', 50, NOW + 1000));
    expect(store.rawHistory.a.readings).toHaveLength(3);
  });

  it('marks a sensor offline once it stops reporting, without any new data', async () => {
    const store = await startStore();
    expect(store.getRow('a')?.status).toBe('online');
    await vi.advanceTimersByTimeAsync(16 * 60_000);
    expect(store.getRow('a')?.status).toBe('offline');
    expect(store.city.aqi).toBeNull();
  });

  it('picks up a sensor that was registered after the page loaded', async () => {
    const store = await startStore();
    fake.sensors = [...fake.sensors, sensor('new', 'Tell')];
    fake.handlers?.onReading(reading('new', 90, NOW + 1000));
    await vi.advanceTimersByTimeAsync(2_500);
    expect(store.getRow('new')?.reading?.aqi).toBe(90);
    expect(store.neighborhoods.map((n) => n.id).sort()).toEqual(['mina', 'tell']);
  });

  it('falls back to polling while the live channel is down, then resyncs', async () => {
    const store = await startStore();
    fake.handlers?.onConnection(true);
    expect(store.connection).toBe('live');

    fake.handlers?.onConnection(false);
    expect(store.connection).toBe('reconnecting');

    fake.latest = [reading('a', 200, NOW + 20_000), reading('b', 80)];
    await vi.advanceTimersByTimeAsync(9_000);
    expect(store.connection).toBe('polling');
    expect(store.getRow('a')?.reading?.aqi).toBe(200);

    const calls = fake.getLatest.mock.calls.length;
    fake.handlers?.onConnection(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.connection).toBe('live');
    expect(fake.getLatest.mock.calls.length).toBe(calls + 1);

    // Polling has stopped.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fake.getLatest.mock.calls.length).toBe(calls + 1);
  });

  it('reports a failed load and recovers on retry', async () => {
    fake.getSensors.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    const store = await startStore();
    expect(store.ready).toBe(false);
    expect(store.error).toContain('503');

    await store.retry();
    expect(store.error).toBeNull();
    expect(store.ready).toBe(true);
  });
});

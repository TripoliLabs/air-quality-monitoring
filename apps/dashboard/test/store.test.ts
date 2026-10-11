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
  /** How far the server's clock is ahead of this device's. */
  serverAhead = 0;
  getServerTime = vi.fn(async () => Date.now() + this.serverAhead);
  getNetworkHourly = vi.fn(async (_days: number, neighborhood?: string) => [
    {
      time: NOW - 3_600_000,
      pm25: neighborhood ? 30 : 20,
      pm10: 40,
      temperature: 20,
      humidity: 50,
      maxAqi: 80,
      sensors: 2,
    },
  ]);
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

  it('loads network history once, and ends the city trend with the live value', async () => {
    const store = await startStore();
    await store.loadCitySeries(1);
    await store.loadCitySeries(1);
    expect(fake.getNetworkHourly).toHaveBeenCalledTimes(1);
    expect(store.cityTrend.map((p) => p.pm25)).toEqual([20, store.city.pm25]);

    // A longer range needs a new request; a shorter one does not.
    await store.loadCitySeries(7);
    await store.loadCitySeries(1);
    expect(fake.getNetworkHourly).toHaveBeenCalledTimes(2);
  });

  it('loads one neighbourhood by the name the source uses', async () => {
    const store = await startStore();
    await store.loadPlaceSeries(store.neighborhoods[0], 1);
    expect(fake.getNetworkHourly).toHaveBeenCalledWith(1, 'Mina');
    expect(store.placeSeries.mina.points[0].pm25).toBe(30);
  });

  it('re-reads the history that is on screen, so hourly charts keep moving', async () => {
    const store = await startStore();
    await store.loadCitySeries(1);
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
    expect(fake.getNetworkHourly.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(store.citySeries.days).toBe(1);
  });

  it('judges "online" by the server clock, so a wrong device clock changes nothing', async () => {
    // This device's clock is 40 minutes behind the server's.
    fake.serverAhead = 40 * 60_000;
    fake.latest = [reading('a', 40, NOW + 40 * 60_000), reading('b', 80, NOW + 40 * 60_000)];
    const store = await startStore();
    expect(store.city.online).toBe(2);

    // And the other way: 40 minutes ahead must not keep stale sensors online.
    setActivePinia(createPinia());
    fake = new FakeService();
    fake.serverAhead = -40 * 60_000;
    fake.latest = [reading('a', 40, NOW - 40 * 60_000 - 20 * 60_000)];
    const { useAirStore } = await import('../src/stores/air');
    const second = useAirStore();
    await second.start();
    expect(second.getRow('a')?.status).toBe('offline');
  });

  it('asks about an unregistered device once, not on every reading', async () => {
    const store = await startStore();
    for (let i = 1; i <= 5; i++) {
      fake.handlers?.onReading(reading('ghost', 90, NOW + i * 1000));
      await vi.advanceTimersByTimeAsync(3_000);
    }
    expect(fake.getSensors).toHaveBeenCalledTimes(2); // the initial load, then one look
    expect(store.getRow('ghost')).toBeUndefined();
  });

  it('keeps the wider range when history requests overlap', async () => {
    const store = await startStore();
    let releaseWeek: (() => void) | undefined;
    fake.getNetworkHourly.mockImplementationOnce(
      () => new Promise((resolve) => (releaseWeek = () => resolve([]))),
    );
    const week = store.loadCitySeries(7);
    await vi.advanceTimersByTimeAsync(0);
    const month = store.loadCitySeries(30); // asked for before the first answered
    await month;
    expect(store.citySeries.days).toBe(30);
    expect(store.citySeriesLoading).toBe(true);
    releaseWeek?.();
    await week;
    expect(store.citySeries.days).toBe(30);
    expect(store.citySeriesLoading).toBe(false);
  });

  it('leaves the loading state when a history request fails', async () => {
    const store = await startStore();
    fake.getNetworkHourly.mockRejectedValueOnce(new Error('503'));
    await store.loadCitySeries(7);
    expect(store.citySeries.days).toBe(7);
    expect(store.citySeries.points).toEqual([]);
    expect(store.citySeriesLoading).toBe(false);
  });

  it('does not lose live readings that arrive while a history request is in flight', async () => {
    const store = await startStore();
    await store.loadReadings('a', 24);
    fake.handlers?.onReading(reading('a', 55, NOW + 5_000));
    await store.loadReadings('a', 24); // the response predates the live reading
    expect(store.rawHistory.a.readings.map((r) => r.aqi)).toEqual([30, 35, 55]);
  });
});

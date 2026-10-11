/**
 * The live picture of the network.
 *
 * One store holds the sensors, their latest readings and the state of the live
 * channel; every view derives what it shows from here, so a reading that
 * arrives over the socket updates the headline, the map, the lists and the open
 * charts at once — nothing on screen waits for a refresh.
 *
 * Staying current, in order of preference:
 *   1. the socket pushes each reading as it is ingested;
 *   2. if the socket drops, the store polls the bulk "latest" endpoint until it
 *      is back, then resyncs;
 *   3. the sensor list is refreshed periodically and whenever an unknown
 *      sensor reports, so newly registered sensors appear on their own.
 */

import { defineStore } from 'pinia';
import { computed, reactive, ref, shallowRef } from 'vue';
import {
  groupByNeighborhood,
  mapLimit,
  type NeighborhoodSummary,
  networkSeries,
  type SensorRow,
  type SeriesPoint,
  sensorStatus,
  summarise,
} from '../lib/stats';
import { createSensorService, type SensorService } from '../services';
import type { ConnectionState, DataSourceKind, HourlyPoint, Reading, Sensor } from '../types';

const CLOCK_MS = 10_000;
const POLL_AFTER_MS = 8_000;
const POLL_EVERY_MS = 30_000;
const SENSOR_REFRESH_MS = 5 * 60_000;
const HISTORY_CONCURRENCY = 6;
const HOUR = 3_600_000;

interface RawHistory {
  hours: number;
  readings: Reading[];
}

interface HourlyHistory {
  days: number;
  points: HourlyPoint[];
}

export const useAirStore = defineStore('air', () => {
  const sensors = shallowRef<Sensor[]>([]);
  const latest = reactive<Record<string, Reading>>({});
  const source = ref<DataSourceKind | null>(null);
  const connection = ref<ConnectionState>('connecting');
  const ready = ref(false);
  const error = ref<string | null>(null);
  /** Coarse clock that drives "online" status; ticks even when no data arrives. */
  const now = ref(Date.now());
  /** The reading that most recently arrived live, for the map's ripple. */
  const lastLive = shallowRef<Reading | null>(null);

  const rawHistory = reactive<Record<string, RawHistory>>({});
  const hourlyHistory = reactive<Record<string, HourlyHistory>>({});
  /** Hourly history for every sensor, loaded on demand for network-wide charts. */
  const networkHourly = shallowRef<{ days: number; bySensor: Record<string, HourlyPoint[]> }>({
    days: 0,
    bySensor: {},
  });
  const networkHourlyLoading = ref(false);

  let service: SensorService | null = null;
  let starting: Promise<void> | null = null;
  let stopRealtime: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollDelay: ReturnType<typeof setTimeout> | null = null;
  let refreshQueued: ReturnType<typeof setTimeout> | null = null;
  const timers: ReturnType<typeof setInterval>[] = [];

  // --- derived --------------------------------------------------------------

  const rows = computed((): SensorRow[] =>
    sensors.value.map((sensor) => {
      const reading = latest[sensor.id] ?? null;
      return { sensor, reading, status: sensorStatus(sensor, reading, now.value) };
    }),
  );

  const city = computed(() => summarise(rows.value));
  const neighborhoods = computed((): NeighborhoodSummary[] => groupByNeighborhood(rows.value));

  /** Network-wide hourly AQI for the last 24 hours, ending with the live value. */
  const cityTrend = computed((): SeriesPoint[] => {
    const series = networkSeries(networkHourly.value.bySensor, now.value - 24 * HOUR);
    const live = city.value;
    if (live.aqi !== null && live.pm25 !== null && series.length) {
      series.push({ time: now.value, pm25: live.pm25, aqi: live.aqi, sensors: live.online });
    }
    return series;
  });

  const rowById = computed(() => new Map(rows.value.map((row) => [row.sensor.id, row])));
  const getRow = (id: string): SensorRow | undefined => rowById.value.get(id.toLowerCase());
  const getNeighborhood = (id: string): NeighborhoodSummary | undefined =>
    neighborhoods.value.find((n) => n.id === id);

  // --- applying data --------------------------------------------------------

  function applyReading(reading: Reading, live: boolean): void {
    const current = latest[reading.sensorId];
    if (current && current.time >= reading.time) return;
    latest[reading.sensorId] = reading;

    if (!live) return;
    lastLive.value = reading;
    now.value = Math.max(now.value, Date.now());

    const history = rawHistory[reading.sensorId];
    if (history) {
      history.readings.push(reading);
      const cutoff = reading.time - history.hours * HOUR;
      while (history.readings.length && history.readings[0].time < cutoff) history.readings.shift();
    }

    // A sensor we have never heard of: it was registered after the page loaded.
    if (!rowById.value.has(reading.sensorId) && !refreshQueued) {
      refreshQueued = setTimeout(() => {
        refreshQueued = null;
        void refreshSensors();
      }, 2_000);
    }
  }

  async function refreshSensors(): Promise<void> {
    if (!service) return;
    try {
      sensors.value = await service.getSensors();
    } catch {
      // Keep the list we have; the next refresh will try again.
    }
  }

  async function syncLatest(): Promise<void> {
    if (!service) return;
    const readings = await service.getLatest();
    for (const reading of readings) applyReading(reading, false);
    now.value = Date.now();
  }

  // --- connection -----------------------------------------------------------

  function stopPolling(): void {
    if (pollDelay) clearTimeout(pollDelay);
    if (pollTimer) clearInterval(pollTimer);
    pollDelay = null;
    pollTimer = null;
  }

  function onConnection(connected: boolean): void {
    if (connected) {
      const wasDown = connection.value !== 'connecting';
      stopPolling();
      connection.value = 'live';
      // Readings may have been missed while the channel was down.
      if (wasDown) void syncLatest().catch(() => undefined);
      return;
    }
    if (connection.value === 'live' || connection.value === 'connecting') {
      connection.value = 'reconnecting';
    }
    if (pollDelay || pollTimer) return;
    pollDelay = setTimeout(() => {
      pollDelay = null;
      const poll = (): void => {
        void syncLatest()
          .then(() => {
            if (connection.value !== 'live') connection.value = 'polling';
          })
          .catch(() => {
            if (connection.value !== 'live') connection.value = 'reconnecting';
          });
      };
      poll();
      pollTimer = setInterval(poll, POLL_EVERY_MS);
    }, POLL_AFTER_MS);
  }

  function onVisible(): void {
    if (document.visibilityState !== 'visible' || !ready.value) return;
    now.value = Date.now();
    void syncLatest().catch(() => undefined);
  }

  // --- lifecycle ------------------------------------------------------------

  async function load(): Promise<void> {
    error.value = null;
    try {
      service ??= await createSensorService();
      source.value = service.kind;
      const [sensorList, readings] = await Promise.all([service.getSensors(), service.getLatest()]);
      sensors.value = sensorList;
      for (const reading of readings) applyReading(reading, false);
      now.value = Date.now();
      ready.value = true;

      stopRealtime ??= service.subscribe({
        onReading: (reading) => applyReading(reading, true),
        onConnection,
      });
      if (timers.length === 0) {
        timers.push(setInterval(() => (now.value = Date.now()), CLOCK_MS));
        timers.push(setInterval(() => void refreshSensors(), SENSOR_REFRESH_MS));
        document.addEventListener('visibilitychange', onVisible);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  /** Connect to the data source. Safe to call from every view; it runs once. */
  function start(): Promise<void> {
    starting ??= load();
    return starting;
  }

  /** Try the initial load again after a failure. */
  function retry(): Promise<void> {
    starting = load();
    return starting;
  }

  function stop(): void {
    stopRealtime?.();
    stopRealtime = null;
    stopPolling();
    for (const timer of timers.splice(0)) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    starting = null;
  }

  // --- history, loaded on demand --------------------------------------------

  async function loadReadings(sensorId: string, hours: number): Promise<void> {
    await start();
    if (!service) return;
    const readings = await service.getReadings(sensorId, hours);
    rawHistory[sensorId] = { hours, readings };
  }

  async function loadHourly(sensorId: string, days: number): Promise<void> {
    await start();
    if (!service) return;
    const points = await service.getHourly(sensorId, days);
    hourlyHistory[sensorId] = { days, points };
  }

  /** History straight from the source, uncached — for exports. */
  async function fetchReadings(sensorId: string, hours: number): Promise<Reading[]> {
    await start();
    return service ? service.getReadings(sensorId, hours) : [];
  }

  async function fetchHourly(sensorId: string, days: number): Promise<HourlyPoint[]> {
    await start();
    return service ? service.getHourly(sensorId, days) : [];
  }

  /** Makes sure hourly history for every sensor covers at least `days`. */
  async function ensureNetworkHourly(days: number): Promise<void> {
    await start();
    if (!service || networkHourlyLoading.value || networkHourly.value.days >= days) return;
    networkHourlyLoading.value = true;
    try {
      const active = service;
      const bySensor: Record<string, HourlyPoint[]> = {};
      await mapLimit(sensors.value, HISTORY_CONCURRENCY, async (sensor) => {
        try {
          bySensor[sensor.id] = await active.getHourly(sensor.id, days);
        } catch {
          bySensor[sensor.id] = [];
        }
      });
      networkHourly.value = { days, bySensor };
    } finally {
      networkHourlyLoading.value = false;
    }
  }

  return {
    sensors,
    latest,
    source,
    connection,
    ready,
    error,
    now,
    lastLive,
    rawHistory,
    hourlyHistory,
    networkHourly,
    networkHourlyLoading,
    rows,
    city,
    neighborhoods,
    cityTrend,
    getRow,
    getNeighborhood,
    start,
    retry,
    stop,
    loadReadings,
    loadHourly,
    fetchReadings,
    fetchHourly,
    ensureNetworkHourly,
  };
});

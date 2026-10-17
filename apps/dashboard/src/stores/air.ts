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
 *      sensor reports, so newly registered sensors appear on their own;
 *   4. hourly history that is on screen is re-read on the same schedule.
 */

import { defineStore } from 'pinia';
import { computed, reactive, ref, shallowRef } from 'vue';
import {
  groupByNeighborhood,
  type NeighborhoodSummary,
  type SensorRow,
  type SeriesPoint,
  sensorStatus,
  summarise,
  toSeries,
} from '../lib/stats';
import { createSensorService, type SensorService } from '../services';
import type {
  ConnectionState,
  DataSourceKind,
  HourlyPoint,
  NetworkHourlyPoint,
  Reading,
  Sensor,
} from '../types';

const CLOCK_MS = 10_000;
const POLL_AFTER_MS = 8_000;
const POLL_EVERY_MS = 30_000;
const SENSOR_REFRESH_MS = 5 * 60_000;
const HOUR = 3_600_000;

interface RawHistory {
  hours: number;
  readings: Reading[];
}

interface NetworkSeries {
  days: number;
  points: NetworkHourlyPoint[];
}

export const useAirStore = defineStore('air', () => {
  const sensors = shallowRef<Sensor[]>([]);
  const latest = reactive<Record<string, Reading>>({});
  const source = ref<DataSourceKind | null>(null);
  const connection = ref<ConnectionState>('connecting');
  const ready = ref(false);
  const error = ref<string | null>(null);
  /**
   * Coarse clock that drives "online" status; ticks even when no data arrives.
   * It runs on the server's time, not the device's: reading timestamps come from
   * the server, and a phone whose clock is wrong would otherwise show the whole
   * network as offline (or keep dead sensors online).
   */
  let clockOffset = 0;
  const serverNow = (): number => Date.now() + clockOffset;
  const now = ref(Date.now());
  /** The reading that most recently arrived live, for the map's ripple. */
  const lastLive = shallowRef<Reading | null>(null);

  const rawHistory = reactive<Record<string, RawHistory>>({});
  const hourlyHistory = reactive<Record<string, HourlyPoint[]>>({});
  /** Hourly history of the whole network, loaded on demand. */
  const citySeries = shallowRef<NetworkSeries>({ days: 0, points: [] });
  const citySeriesLoading = ref(false);
  /** Hourly history of single neighbourhoods, keyed by neighbourhood id. */
  const placeSeries = reactive<Record<string, NetworkSeries>>({});

  let service: SensorService | null = null;
  let starting: Promise<void> | null = null;
  let stopRealtime: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollDelay: ReturnType<typeof setTimeout> | null = null;
  let refreshQueued: ReturnType<typeof setTimeout> | null = null;
  /** Devices that report but are not in the sensor list; rechecked on the periodic refresh. */
  const unknownDevices = new Set<string>();
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
    const series = toSeries(citySeries.value.points, now.value - 24 * HOUR);
    const live = city.value;
    if (live.aqi !== null && live.pm25 !== null && live.pm10 !== null && series.length) {
      series.push({
        time: now.value,
        pm25: live.pm25,
        pm10: live.pm10,
        aqi: live.aqi,
        sensors: live.online,
      });
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
    now.value = Math.max(now.value, serverNow());

    const history = rawHistory[reading.sensorId];
    if (history) {
      history.readings.push(reading);
      const cutoff = reading.time - history.hours * HOUR;
      while (history.readings.length && history.readings[0].time < cutoff) history.readings.shift();
    }

    // A sensor we have never heard of: it may have been registered after the
    // page loaded, so look once. A device that is still unknown after that
    // (in ChirpStack but not registered) is not asked about again on every
    // uplink; the periodic refresh picks it up if it is registered later.
    if (!rowById.value.has(reading.sensorId) && !unknownDevices.has(reading.sensorId)) {
      unknownDevices.add(reading.sensorId);
      refreshQueued ??= setTimeout(() => {
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

  async function syncClock(): Promise<void> {
    if (!service) return;
    try {
      const sent = Date.now();
      const server = await service.getServerTime();
      // Assume the answer was stamped half-way through the round trip.
      clockOffset = server - (sent + Date.now()) / 2;
    } catch {
      // Keep the offset we have (zero until the first success).
    }
  }

  async function syncLatest(): Promise<void> {
    if (!service) return;
    const readings = await service.getLatest();
    for (const reading of readings) applyReading(reading, false);
    now.value = serverNow();
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
    now.value = serverNow();
    void syncLatest().catch(() => undefined);
  }

  // --- lifecycle ------------------------------------------------------------

  async function load(): Promise<void> {
    error.value = null;
    try {
      service ??= await createSensorService();
      source.value = service.kind;
      const [sensorList, readings] = await Promise.all([
        service.getSensors(),
        service.getLatest(),
        syncClock(),
      ]);
      sensors.value = sensorList;
      for (const reading of readings) applyReading(reading, false);
      now.value = serverNow();
      ready.value = true;

      stopRealtime ??= service.subscribe({
        onReading: (reading) => applyReading(reading, true),
        onConnection,
      });
      if (timers.length === 0) {
        timers.push(setInterval(() => (now.value = serverNow()), CLOCK_MS));
        timers.push(
          setInterval(() => {
            unknownDevices.clear();
            void refreshSensors();
            void syncClock();
            refreshSeries();
          }, SENSOR_REFRESH_MS),
        );
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
    // Live readings may have been appended while the request was in flight.
    const last = readings[readings.length - 1]?.time ?? 0;
    const arrived = rawHistory[sensorId]?.readings.filter((r) => r.time > last) ?? [];
    rawHistory[sensorId] = { hours, readings: [...readings, ...arrived] };
  }

  /** Cached per sensor and range, so overlapping requests cannot overwrite each other. */
  const hourlyKey = (sensorId: string, days: number): string => `${sensorId}:${days}`;

  async function loadHourly(sensorId: string, days: number): Promise<void> {
    await start();
    if (!service) return;
    hourlyHistory[hourlyKey(sensorId, days)] = await service.getHourly(sensorId, days);
  }

  const getHourly = (sensorId: string, days: number): HourlyPoint[] | undefined =>
    hourlyHistory[hourlyKey(sensorId, days)];

  /** History straight from the source, uncached — for exports. */
  async function fetchReadings(sensorId: string, hours: number): Promise<Reading[]> {
    await start();
    return service ? service.getReadings(sensorId, hours) : [];
  }

  async function fetchHourly(sensorId: string, days: number): Promise<HourlyPoint[]> {
    await start();
    return service ? service.getHourly(sensorId, days) : [];
  }

  /**
   * Makes sure the network-wide hourly history covers at least `days`.
   * Requests may overlap (a second range picked before the first answered): the
   * widest answer wins, and `citySeriesLoading` is true while any is pending.
   * A failed request still records the range it was for, with whatever points
   * are already there, so the page leaves its loading state and the periodic
   * refresh tries again.
   */
  let cityRequests = 0;
  async function loadCitySeries(days: number, force = false): Promise<void> {
    await start();
    if (!service || (!force && citySeries.value.days >= days)) return;
    cityRequests++;
    citySeriesLoading.value = true;
    try {
      const points = await service.getNetworkHourly(days);
      if (force || days >= citySeries.value.days) citySeries.value = { days, points };
    } catch {
      if (days > citySeries.value.days)
        citySeries.value = { days, points: citySeries.value.points };
    } finally {
      citySeriesLoading.value = --cityRequests > 0;
    }
  }

  /** Makes sure one neighbourhood's hourly history covers at least `days`. */
  async function loadPlaceSeries(
    place: Pick<NeighborhoodSummary, 'id' | 'name'>,
    days: number,
    force = false,
  ): Promise<void> {
    await start();
    const loaded = placeSeries[place.id];
    if (!service || (!force && (loaded?.days ?? 0) >= days)) return;
    try {
      const points = await service.getNetworkHourly(days, place.name);
      if (force || days >= (placeSeries[place.id]?.days ?? 0))
        placeSeries[place.id] = { days, points };
    } catch {
      // Record the range so the periodic refresh tries again.
      if (days > (placeSeries[place.id]?.days ?? 0)) {
        placeSeries[place.id] = { days, points: placeSeries[place.id]?.points ?? [] };
      }
    }
  }

  /** Re-reads whatever history is on screen, so hourly charts keep moving. */
  function refreshSeries(): void {
    if (citySeries.value.days) void loadCitySeries(citySeries.value.days, true);
    for (const place of neighborhoods.value) {
      const loaded = placeSeries[place.id];
      if (loaded) void loadPlaceSeries(place, loaded.days, true);
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
    getHourly,
    citySeries,
    citySeriesLoading,
    placeSeries,
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
    loadCitySeries,
    loadPlaceSeries,
  };
});

/**
 * Sensor data store. Talks to the data source through the SensorService
 * interface (live backend or mock), and derives neighbourhood aggregates from
 * whatever sensors are loaded — so it works identically for real and mock data.
 */

import { getAqiCategory } from '@composables/useAqi';
import type { SensorDefinition } from '@mock/sensors';
import { calculateAQI, type SensorReading } from '@mock/simulator';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createSensorService, type SensorService } from '../services';

const MAX_HISTORY = 288; // 24h at 5-min cadence

export interface SensorTimeSeries {
  definition: SensorDefinition;
  latest: SensorReading | null;
  history: SensorReading[];
}

export interface NeighborhoodSummary {
  id: string;
  name: string;
  nameAr: string;
  sensorCount: number;
  onlineCount: number;
  avgAqi: number;
  avgPm25: number;
  avgPm10: number;
  avgTemp: number;
  avgHumidity: number;
}

export interface NeighborhoodInfo {
  id: string;
  name: string;
  nameAr: string;
}

export const useSensorsStore = defineStore('sensors', () => {
  const sensorMap = ref<Map<string, SensorTimeSeries>>(new Map());
  const isSimulating = ref(false);
  const lastUpdate = ref<Date | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let service: SensorService | null = null;
  let unsubscribe: (() => void) | null = null;

  const allSensors = computed((): SensorTimeSeries[] => Array.from(sensorMap.value.values()));

  const activeSensorCount = computed(
    (): number =>
      allSensors.value.filter((s) => s.definition.status === 'online' && s.latest !== null).length,
  );

  const averageAqi = computed((): number => {
    const withReadings = allSensors.value.filter((s) => s.latest !== null);
    if (withReadings.length === 0) return 0;
    const sum = withReadings.reduce((acc, s) => acc + (s.latest?.aqi ?? 0), 0);
    return Math.round(sum / withReadings.length);
  });

  /** Neighbourhood aggregates, grouped from the loaded sensors (data-driven). */
  const neighborhoodSummaries = computed((): NeighborhoodSummary[] => {
    const groups = new Map<string, SensorTimeSeries[]>();
    for (const s of allSensors.value) {
      const id = s.definition.neighborhoodId;
      const group = groups.get(id);
      if (group) group.push(s);
      else groups.set(id, [s]);
    }

    return Array.from(groups.entries())
      .map(([id, sensors]): NeighborhoodSummary => {
        const def = sensors[0].definition;
        const withReadings = sensors.filter((s) => s.latest !== null);
        const count = withReadings.length;
        const avg = (sel: (r: SensorReading) => number): number =>
          count === 0
            ? 0
            : withReadings.reduce((sum, s) => sum + sel(s.latest as SensorReading), 0) / count;
        const avgPm25 = avg((r) => r.pm2_5);

        return {
          id,
          name: def.location.neighborhood,
          nameAr: def.location.neighborhoodAr,
          sensorCount: sensors.length,
          onlineCount: sensors.filter((s) => s.definition.status === 'online').length,
          avgAqi: count === 0 ? 0 : calculateAQI(avgPm25),
          avgPm25: Math.round(avgPm25 * 10) / 10,
          avgPm10: Math.round(avg((r) => r.pm10) * 10) / 10,
          avgTemp: Math.round(avg((r) => r.temperature) * 10) / 10,
          avgHumidity: Math.round(avg((r) => r.humidity) * 10) / 10,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const neighborhoods = computed((): NeighborhoodInfo[] =>
    neighborhoodSummaries.value.map((n) => ({ id: n.id, name: n.name, nameAr: n.nameAr })),
  );

  const worstNeighborhood = computed((): NeighborhoodSummary | null => {
    const summaries = neighborhoodSummaries.value.filter((n) => n.onlineCount > 0);
    return summaries.length ? summaries.reduce((w, n) => (n.avgAqi > w.avgAqi ? n : w)) : null;
  });

  const bestNeighborhood = computed((): NeighborhoodSummary | null => {
    const summaries = neighborhoodSummaries.value.filter((n) => n.onlineCount > 0);
    return summaries.length ? summaries.reduce((b, n) => (n.avgAqi < b.avgAqi ? n : b)) : null;
  });

  const cityAqiCategory = computed(() => getAqiCategory(averageAqi.value));

  function applyReading(reading: SensorReading): void {
    const series = sensorMap.value.get(reading.sensorId);
    if (!series) return;
    series.latest = reading;
    series.history.push(reading);
    if (series.history.length > MAX_HISTORY) series.history.shift();
    lastUpdate.value = new Date();
  }

  /** Connect to the data source, load sensors + history, and stream live updates. */
  async function startSimulation(): Promise<void> {
    if (isSimulating.value || loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      service = createSensorService();

      const sensors = await service.getSensors();
      const map = new Map<string, SensorTimeSeries>();
      for (const def of sensors) map.set(def.id, { definition: def, latest: null, history: [] });
      sensorMap.value = map;

      await Promise.all(
        sensors.map(async (def) => {
          const history = await service?.getHistory(def.id);
          const series = sensorMap.value.get(def.id);
          if (series && history) {
            series.history = history;
            series.latest = history[history.length - 1] ?? null;
          }
        }),
      );
      lastUpdate.value = new Date();

      unsubscribe = service.subscribe(applyReading);
      isSimulating.value = true;
    } catch (err) {
      // Leave isSimulating false so the view can retry (button or re-mount).
      error.value = err instanceof Error ? err.message : String(err);
      service?.dispose();
      service = null;
    } finally {
      loading.value = false;
    }
  }

  /** Re-attempt the initial load after a failure. */
  async function retry(): Promise<void> {
    error.value = null;
    await startSimulation();
  }

  function stopSimulation(): void {
    unsubscribe?.();
    unsubscribe = null;
    service?.dispose();
    service = null;
    isSimulating.value = false;
  }

  const getSensorById = (id: string): SensorTimeSeries | undefined => sensorMap.value.get(id);
  const getSensorsByNeighborhood = (neighborhoodId: string): SensorTimeSeries[] =>
    allSensors.value.filter((s) => s.definition.neighborhoodId === neighborhoodId);
  const getNeighborhood = (id: string): NeighborhoodInfo | undefined =>
    neighborhoods.value.find((n) => n.id === id);

  return {
    sensorMap,
    isSimulating,
    lastUpdate,
    loading,
    error,
    retry,
    allSensors,
    activeSensorCount,
    averageAqi,
    neighborhoods,
    neighborhoodSummaries,
    worstNeighborhood,
    bestNeighborhood,
    cityAqiCategory,
    startSimulation,
    stopSimulation,
    getSensorById,
    getSensorsByNeighborhood,
    getNeighborhood,
  };
});

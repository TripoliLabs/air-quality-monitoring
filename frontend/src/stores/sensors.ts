/**
 * Sensor data store
 * Manages sensor state, simulation lifecycle, and neighborhood aggregation
 */

import { getAqiCategory } from '@composables/useAqi';
import { NEIGHBORHOODS, SENSORS, type SensorDefinition } from '@mock/sensors';
import { AirQualitySimulator, calculateAQI, type SensorReading } from '@mock/simulator';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

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

export const useSensorsStore = defineStore('sensors', () => {
  const sensorMap = ref<Map<string, SensorTimeSeries>>(new Map());
  const isSimulating = ref(false);
  const lastUpdate = ref<Date | null>(null);
  const simulator = shallowRef<AirQualitySimulator | null>(null);

  // Initialize sensor map from static definitions
  function initSensorMap(): void {
    const map = new Map<string, SensorTimeSeries>();
    for (const def of SENSORS) {
      map.set(def.id, {
        definition: def,
        latest: null,
        history: [],
      });
    }
    sensorMap.value = map;
  }

  const allSensors = computed((): SensorTimeSeries[] => {
    return Array.from(sensorMap.value.values());
  });

  const activeSensorCount = computed((): number => {
    return allSensors.value.filter(
      (s) => s.definition.status === 'online' && s.latest !== null,
    ).length;
  });

  const averageAqi = computed((): number => {
    const readings = allSensors.value.filter((s) => s.latest !== null);
    if (readings.length === 0) return 0;
    const sum = readings.reduce((acc, s) => acc + (s.latest?.aqi ?? 0), 0);
    return Math.round(sum / readings.length);
  });

  /** Aggregate sensor data per neighborhood */
  const neighborhoodSummaries = computed((): NeighborhoodSummary[] => {
    return NEIGHBORHOODS.map((n) => {
      const sensors = allSensors.value.filter((s) => s.definition.neighborhoodId === n.id);
      const withReadings = sensors.filter((s) => s.latest !== null);
      const count = withReadings.length;

      if (count === 0) {
        return {
          id: n.id,
          name: n.name,
          nameAr: n.nameAr,
          sensorCount: sensors.length,
          onlineCount: 0,
          avgAqi: 0,
          avgPm25: 0,
          avgPm10: 0,
          avgTemp: 0,
          avgHumidity: 0,
        };
      }

      const avgPm25 =
        withReadings.reduce((sum, s) => sum + (s.latest?.pm2_5 ?? 0), 0) / count;

      return {
        id: n.id,
        name: n.name,
        nameAr: n.nameAr,
        sensorCount: sensors.length,
        onlineCount: sensors.filter((s) => s.definition.status === 'online').length,
        avgAqi: calculateAQI(avgPm25),
        avgPm25: Math.round(avgPm25 * 10) / 10,
        avgPm10:
          Math.round(
            (withReadings.reduce((sum, s) => sum + (s.latest?.pm10 ?? 0), 0) / count) * 10,
          ) / 10,
        avgTemp:
          Math.round(
            (withReadings.reduce((sum, s) => sum + (s.latest?.temperature ?? 0), 0) / count) * 10,
          ) / 10,
        avgHumidity:
          Math.round(
            (withReadings.reduce((sum, s) => sum + (s.latest?.humidity ?? 0), 0) / count) * 10,
          ) / 10,
      };
    });
  });

  const worstNeighborhood = computed((): NeighborhoodSummary | null => {
    const summaries = neighborhoodSummaries.value.filter((n) => n.onlineCount > 0);
    if (summaries.length === 0) return null;
    return summaries.reduce((worst, n) => (n.avgAqi > worst.avgAqi ? n : worst));
  });

  const bestNeighborhood = computed((): NeighborhoodSummary | null => {
    const summaries = neighborhoodSummaries.value.filter((n) => n.onlineCount > 0);
    if (summaries.length === 0) return null;
    return summaries.reduce((best, n) => (n.avgAqi < best.avgAqi ? n : best));
  });

  const cityAqiCategory = computed(() => {
    return getAqiCategory(averageAqi.value);
  });

  function startSimulation(): void {
    if (isSimulating.value) return;

    initSensorMap();

    const sim = new AirQualitySimulator();
    simulator.value = sim;

    // Load historical data
    for (const [id, series] of sensorMap.value) {
      const history = sim.getHistory(id);
      const latest = sim.getLatest(id) ?? null;
      series.history = history;
      series.latest = latest;
    }
    lastUpdate.value = new Date();

    // Subscribe to live updates
    sim.onUpdate((readings: SensorReading[]) => {
      for (const reading of readings) {
        const series = sensorMap.value.get(reading.sensorId);
        if (series) {
          series.latest = reading;
          series.history.push(reading);
          if (series.history.length > 288) series.history.shift();
        }
      }
      lastUpdate.value = new Date();
    });

    sim.start(4000);
    isSimulating.value = true;
  }

  function stopSimulation(): void {
    simulator.value?.stop();
    simulator.value = null;
    isSimulating.value = false;
  }

  function getSensorById(id: string): SensorTimeSeries | undefined {
    return sensorMap.value.get(id);
  }

  function getSensorsByNeighborhood(neighborhoodId: string): SensorTimeSeries[] {
    return allSensors.value.filter((s) => s.definition.neighborhoodId === neighborhoodId);
  }

  return {
    sensorMap,
    isSimulating,
    lastUpdate,
    allSensors,
    activeSensorCount,
    averageAqi,
    neighborhoodSummaries,
    worstNeighborhood,
    bestNeighborhood,
    cityAqiCategory,
    startSimulation,
    stopSimulation,
    getSensorById,
    getSensorsByNeighborhood,
  };
});

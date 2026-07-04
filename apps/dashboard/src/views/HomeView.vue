<script setup lang="ts">
import AqiGauge from '@components/AqiGauge.vue';
import DataDownloadPanel from '@components/DataDownloadPanel.vue';
import SensorMap from '@components/SensorMap.vue';
import SensorTable from '@components/SensorTable.vue';
import StatsBar from '@components/StatsBar.vue';
import TimeSeriesChart from '@components/TimeSeriesChart.vue';
import { useSensorsStore } from '@stores/sensors';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const store = useSensorsStore();
const router = useRouter();

function onSensorClick(sensorId: string): void {
  router.push({ name: 'sensor-detail', params: { id: sensorId } });
}

// Pick a sensor from the worst neighborhood for the mini chart
const overviewSensorId = computed(() => {
  const worst = store.worstNeighborhood;
  if (!worst) return 'sensor_001';
  const sensors = store.getSensorsByNeighborhood(worst.id);
  return sensors[0]?.definition.id ?? 'sensor_001';
});

onMounted(() => {
  if (!store.isSimulating) {
    store.startSimulation();
  }
});
</script>

<template>
  <div class="space-y-4">
    <!-- Load failure — surface it with a retry instead of a silently blank page -->
    <div
      v-if="store.error"
      class="flex items-center justify-between gap-3 rounded-xl border border-red-800 bg-red-950/40 p-4"
    >
      <span class="text-sm text-red-300">{{ t('common.error') }}</span>
      <button
        type="button"
        class="rounded-lg bg-red-800 px-3 py-1 text-sm text-red-100 hover:bg-red-700"
        @click="store.retry()"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Initial load -->
    <div
      v-else-if="store.loading && store.allSensors.length === 0"
      class="p-8 text-center text-sm text-gray-500"
    >
      {{ t('common.loading') }}
    </div>

    <!-- Stats Bar -->
    <StatsBar />

    <!-- Summary Cards Row: AQI Gauge + Mini Chart -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <!-- City Average AQI -->
      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p class="mb-1 text-center text-xs text-gray-500">{{ t('dashboard.cityAverage') }}</p>
        <AqiGauge :value="store.averageAqi" />
      </div>

      <!-- Mini Time Series -->
      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p class="mb-1 text-xs text-gray-500">{{ t('dashboard.trend24h') }}</p>
        <TimeSeriesChart :sensor-id="overviewSensorId" height="170px" />
      </div>
    </div>

    <!-- Full-Width Map -->
    <SensorMap :sensors="store.allSensors" height="500px" @sensor-click="onSensorClick" />

    <!-- Sensor Table -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <SensorTable />
    </div>

    <!-- Download Panel -->
    <DataDownloadPanel />
  </div>
</template>

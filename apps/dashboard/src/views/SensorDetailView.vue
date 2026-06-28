<script setup lang="ts">
import AqiBadge from '@components/AqiBadge.vue';
import ReadingCard from '@components/ReadingCard.vue';
import SensorMap from '@components/SensorMap.vue';
import TimeSeriesChart from '@components/TimeSeriesChart.vue';
import { useSensorsStore } from '@stores/sensors';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const store = useSensorsStore();

const sensorId = route.params.id as string;

onMounted(() => {
  if (!store.isSimulating) {
    store.startSimulation();
  }
});

const sensor = computed(() => store.getSensorById(sensorId));
const latest = computed(() => sensor.value?.latest ?? null);

const sensorName = computed(() => {
  if (!sensor.value) return sensorId;
  return locale.value === 'ar' ? sensor.value.definition.nameAr : sensor.value.definition.name;
});

const neighborhoodName = computed(() => {
  if (!sensor.value) return '';
  return locale.value === 'ar'
    ? sensor.value.definition.location.neighborhoodAr
    : sensor.value.definition.location.neighborhood;
});

const sensorArray = computed(() => {
  if (!sensor.value) return [];
  return [sensor.value];
});

const sensorCenter = computed(() => {
  if (!sensor.value) return undefined;
  return sensor.value.definition.location;
});

function batteryPercent(mv: number): number {
  return Math.round(((mv - 3200) / (4200 - 3200)) * 100);
}

function goBack(): void {
  router.push({ name: 'dashboard' });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <button
        class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 transition hover:bg-gray-700"
        @click="goBack"
      >
        <i class="pi pi-arrow-left mr-1"></i>
        {{ t('sensor.backToDashboard') }}
      </button>
      <div class="flex-1">
        <h2 class="text-2xl font-bold text-gray-100">{{ sensorName }}</h2>
        <p class="text-sm text-gray-400">{{ neighborhoodName }}</p>
      </div>
      <AqiBadge v-if="latest" :aqi="latest.aqi" size="lg" />
    </div>

    <!-- Reading Cards -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ReadingCard
        label="PM2.5"
        :value="latest?.pm2_5?.toFixed(1) ?? '--'"
        unit="ug/m3"
        icon="pi pi-cloud"
      />
      <ReadingCard
        label="PM10"
        :value="latest?.pm10?.toFixed(1) ?? '--'"
        unit="ug/m3"
        icon="pi pi-cloud"
      />
      <ReadingCard
        :label="t('readings.temperature')"
        :value="latest?.temperature?.toFixed(1) ?? '--'"
        unit="°C"
        icon="pi pi-sun"
      />
      <ReadingCard
        :label="t('readings.humidity')"
        :value="latest?.humidity?.toFixed(1) ?? '--'"
        unit="%"
        icon="pi pi-wave-pulse"
      />
    </div>

    <!-- Time Series Chart -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 class="mb-2 text-lg font-semibold text-gray-100">{{ t('readings.history') }}</h3>
      <TimeSeriesChart :sensor-id="sensorId" height="350px" show-zoom />
    </div>

    <!-- Map + Metadata -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- Mini Map -->
      <div>
        <h3 class="mb-2 text-lg font-semibold text-gray-100">{{ t('sensor.location') }}</h3>
        <SensorMap
          :sensors="sensorArray"
          :selected-sensor-id="sensorId"
          :center="sensorCenter"
          :zoom="15"
          height="280px"
          :interactive="false"
        />
      </div>

      <!-- Metadata -->
      <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 class="mb-4 text-lg font-semibold text-gray-100">{{ t('sensor.metadata') }}</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-gray-800 pb-2">
            <span class="text-sm text-gray-400">{{ t('sensor.id') }}</span>
            <span class="font-mono text-sm text-gray-200">{{ sensorId }}</span>
          </div>
          <div class="flex items-center justify-between border-b border-gray-800 pb-2">
            <span class="text-sm text-gray-400">{{ t('sensor.battery') }}</span>
            <span class="text-sm text-gray-200">
              {{ latest ? `${latest.batteryMv}mV (${batteryPercent(latest.batteryMv)}%)` : '--' }}
            </span>
          </div>
          <div class="flex items-center justify-between border-b border-gray-800 pb-2">
            <span class="text-sm text-gray-400">{{ t('sensor.signal') }}</span>
            <span class="text-sm text-gray-200">
              {{ latest ? `${latest.signalStrength} dBm` : '--' }}
            </span>
          </div>
          <div class="flex items-center justify-between border-b border-gray-800 pb-2">
            <span class="text-sm text-gray-400">{{ t('sensors.status') }}</span>
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              :class="{
                'bg-green-900/40 text-green-400': sensor?.definition.status === 'online',
                'bg-red-900/40 text-red-400': sensor?.definition.status === 'offline',
                'bg-yellow-900/40 text-yellow-400': sensor?.definition.status === 'maintenance',
              }"
            >
              {{ sensor?.definition.status ?? '--' }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-400">{{ t('sensor.installed') }}</span>
            <span class="text-sm text-gray-200">
              {{ sensor?.definition.installDate ?? '--' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

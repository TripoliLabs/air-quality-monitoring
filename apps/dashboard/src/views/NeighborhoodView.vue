<script setup lang="ts">
import AqiBadge from '@components/AqiBadge.vue';
import ReadingCard from '@components/ReadingCard.vue';
import SensorMap from '@components/SensorMap.vue';
import { useSensorsStore, type SensorTimeSeries } from '@stores/sensors';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const store = useSensorsStore();

// Computed so same-route navigation (component reused, no remount) updates the view.
const neighborhoodId = computed(() => route.params.id as string);

onMounted(() => {
  if (!store.isSimulating) {
    store.startSimulation();
  }
});

const neighborhood = computed(() => {
  return store.getNeighborhood(neighborhoodId.value);
});

const sensors = computed(() => {
  return store.getSensorsByNeighborhood(neighborhoodId.value);
});

/** Map centre = mean position of the neighbourhood's sensors. */
const center = computed(() => {
  const list = sensors.value;
  if (list.length === 0) return undefined;
  const lat = list.reduce((s, x) => s + x.definition.location.latitude, 0) / list.length;
  const lon = list.reduce((s, x) => s + x.definition.location.longitude, 0) / list.length;
  return { latitude: lat, longitude: lon };
});

const neighborhoodName = computed(() => {
  if (!neighborhood.value) return neighborhoodId.value;
  return locale.value === 'ar' ? neighborhood.value.nameAr : neighborhood.value.name;
});

const averages = computed(() => {
  const withReadings = sensors.value.filter((s) => s.latest !== null);
  const count = withReadings.length;
  if (count === 0) {
    return { aqi: 0, pm25: 0, pm10: 0, temp: 0, humidity: 0 };
  }
  const pm25 = withReadings.reduce((sum, s) => sum + (s.latest?.pm2_5 ?? 0), 0) / count;
  const pm10 = withReadings.reduce((sum, s) => sum + (s.latest?.pm10 ?? 0), 0) / count;
  const temp = withReadings.reduce((sum, s) => sum + (s.latest?.temperature ?? 0), 0) / count;
  const humidity = withReadings.reduce((sum, s) => sum + (s.latest?.humidity ?? 0), 0) / count;
  const aqi = Math.round(withReadings.reduce((sum, s) => sum + (s.latest?.aqi ?? 0), 0) / count);
  return {
    aqi,
    pm25: Math.round(pm25 * 10) / 10,
    pm10: Math.round(pm10 * 10) / 10,
    temp: Math.round(temp * 10) / 10,
    humidity: Math.round(humidity * 10) / 10,
  };
});

function getSensorName(sensor: SensorTimeSeries): string {
  return locale.value === 'ar' ? sensor.definition.nameAr : sensor.definition.name;
}

function onRowClick(event: { data: SensorTimeSeries }): void {
  router.push({ name: 'sensor-detail', params: { id: event.data.definition.id } });
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
        {{ t('neighborhood.backToDashboard') }}
      </button>
      <div class="flex-1">
        <h2 class="text-2xl font-bold text-gray-100">{{ neighborhoodName }}</h2>
        <p class="text-sm text-gray-400">{{ sensors.length }} {{ t('neighborhood.sensors') }}</p>
      </div>
      <AqiBadge v-if="averages.aqi > 0" :aqi="averages.aqi" size="lg" />
    </div>

    <!-- Map (zoomed to neighborhood) -->
    <SensorMap
      :sensors="sensors"
      :center="center"
      :zoom="15.5"
      height="400px"
      @sensor-click="(id: string) => router.push({ name: 'sensor-detail', params: { id } })"
    />

    <!-- Average Reading Cards -->
    <div>
      <h3 class="mb-2 text-lg font-semibold text-gray-100">
        {{ t('neighborhood.averages') }}
      </h3>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ReadingCard label="PM2.5" :value="averages.pm25 || '--'" unit="ug/m3" icon="pi pi-cloud" />
        <ReadingCard label="PM10" :value="averages.pm10 || '--'" unit="ug/m3" icon="pi pi-cloud" />
        <ReadingCard
          :label="t('readings.temperature')"
          :value="averages.temp || '--'"
          unit="°C"
          icon="pi pi-sun"
        />
        <ReadingCard
          :label="t('readings.humidity')"
          :value="averages.humidity || '--'"
          unit="%"
          icon="pi pi-wave-pulse"
        />
      </div>
    </div>

    <!-- Sensor Table -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 class="mb-3 text-lg font-semibold text-gray-100">
        {{ t('neighborhood.sensors') }}
      </h3>
      <DataTable
        :value="sensors"
        striped-rows
        row-hover
        sort-field="definition.name"
        :sort-order="1"
        class="cursor-pointer"
        @row-click="onRowClick"
      >
        <Column :header="t('sensors.name')" sortable sort-field="definition.name">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span class="font-medium text-gray-100">{{ getSensorName(data) }}</span>
          </template>
        </Column>
        <Column header="AQI" sortable sort-field="latest.aqi">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <AqiBadge v-if="data.latest" :aqi="data.latest.aqi" size="sm" />
            <span v-else class="text-gray-500">--</span>
          </template>
        </Column>
        <Column header="PM2.5" sortable sort-field="latest.pm2_5">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span class="text-gray-300">
              {{ data.latest?.pm2_5?.toFixed(1) ?? '--' }}
            </span>
          </template>
        </Column>
        <Column header="PM10" sortable sort-field="latest.pm10">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span class="text-gray-300">
              {{ data.latest?.pm10?.toFixed(1) ?? '--' }}
            </span>
          </template>
        </Column>
        <Column :header="t('readings.temperature')" sortable sort-field="latest.temperature">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span class="text-gray-300">
              {{ data.latest ? `${data.latest.temperature.toFixed(1)}°C` : '--' }}
            </span>
          </template>
        </Column>
        <Column :header="t('readings.humidity')" sortable sort-field="latest.humidity">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span class="text-gray-300">
              {{ data.latest ? `${data.latest.humidity.toFixed(1)}%` : '--' }}
            </span>
          </template>
        </Column>
        <Column :header="t('sensors.status')">
          <template #body="{ data }: { data: SensorTimeSeries }">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
              :class="{
                'bg-green-900/40 text-green-400': data.definition.status === 'online',
                'bg-red-900/40 text-red-400': data.definition.status === 'offline',
                'bg-yellow-900/40 text-yellow-400': data.definition.status === 'maintenance',
              }"
            >
              {{ data.definition.status }}
            </span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

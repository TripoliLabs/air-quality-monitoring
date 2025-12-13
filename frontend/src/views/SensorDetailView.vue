<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const route = useRoute();
const { t } = useI18n();

const sensorId = route.params.id as string;
const _sensor = ref(null); // TODO: populate from API
const _readings = ref([]); // TODO: populate from API
const loading = ref(true);

onMounted(async () => {
  // TODO: Fetch sensor details and readings from API
  loading.value = false;
});
</script>

<template>
  <div class="space-y-6">
    <!-- Sensor Header -->
    <section class="rounded-lg bg-white p-4 shadow">
      <h2 class="text-2xl font-semibold">{{ t('sensor.details') }}</h2>
      <p class="text-gray-500">ID: {{ sensorId }}</p>
    </section>

    <!-- Current Readings -->
    <section class="rounded-lg bg-white p-4 shadow">
      <h3 class="mb-4 text-xl font-semibold">{{ t('readings.current') }}</h3>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="text-center">
          <p class="text-sm text-gray-600">PM2.5</p>
          <p class="text-2xl font-bold">-- µg/m³</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-600">PM10</p>
          <p class="text-2xl font-bold">-- µg/m³</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-600">{{ t('readings.temperature') }}</p>
          <p class="text-2xl font-bold">--°C</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-600">{{ t('readings.humidity') }}</p>
          <p class="text-2xl font-bold">--%</p>
        </div>
      </div>
    </section>

    <!-- Historical Chart -->
    <section class="rounded-lg bg-white p-4 shadow">
      <h3 class="mb-4 text-xl font-semibold">{{ t('readings.history') }}</h3>
      <div class="flex h-64 items-center justify-center rounded bg-gray-100">
        <!-- Chart.js chart will be rendered here -->
        <p class="text-gray-500">Chart loading...</p>
      </div>
    </section>
  </div>
</template>

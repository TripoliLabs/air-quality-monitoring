<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

const route = useRoute();
const { t } = useI18n();

const sensorId = route.params.id as string;
const sensor = ref(null);
const readings = ref([]);
const loading = ref(true);

onMounted(async () => {
  // TODO: Fetch sensor details and readings from API
  loading.value = false;
});
</script>

<template>
  <div class="space-y-6">
    <!-- Sensor Header -->
    <section class="bg-white rounded-lg shadow p-4">
      <h2 class="text-2xl font-semibold">{{ t('sensor.details') }}</h2>
      <p class="text-gray-500">ID: {{ sensorId }}</p>
    </section>

    <!-- Current Readings -->
    <section class="bg-white rounded-lg shadow p-4">
      <h3 class="text-xl font-semibold mb-4">{{ t('readings.current') }}</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
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
    <section class="bg-white rounded-lg shadow p-4">
      <h3 class="text-xl font-semibold mb-4">{{ t('readings.history') }}</h3>
      <div class="h-64 bg-gray-100 rounded flex items-center justify-center">
        <!-- Chart.js chart will be rendered here -->
        <p class="text-gray-500">Chart loading...</p>
      </div>
    </section>
  </div>
</template>

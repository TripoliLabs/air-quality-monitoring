<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const sensors = ref([]);
const loading = ref(true);

onMounted(async () => {
  // TODO: Fetch sensors from API
  loading.value = false;
});
</script>

<template>
  <div class="space-y-6">
    <!-- Map Section -->
    <section class="rounded-lg bg-white p-4 shadow">
      <h2 class="mb-4 text-xl font-semibold">{{ t('map.title') }}</h2>
      <div class="flex h-96 items-center justify-center rounded bg-gray-200">
        <!-- MapLibre GL JS map will be rendered here -->
        <p class="text-gray-500">Map loading...</p>
      </div>
    </section>

    <!-- AQI Overview -->
    <section class="rounded-lg bg-white p-4 shadow">
      <h2 class="mb-4 text-xl font-semibold">{{ t('aqi.current') }}</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="rounded-lg bg-green-100 p-4 text-center">
          <p class="text-sm text-gray-600">{{ t('aqi.good') }}</p>
          <p class="text-4xl font-bold text-green-600">--</p>
          <p class="text-xs text-gray-500">{{ t('sensors.count', { count: 0 }) }}</p>
        </div>
        <div class="rounded-lg bg-yellow-100 p-4 text-center">
          <p class="text-sm text-gray-600">{{ t('aqi.moderate') }}</p>
          <p class="text-4xl font-bold text-yellow-600">--</p>
          <p class="text-xs text-gray-500">{{ t('sensors.count', { count: 0 }) }}</p>
        </div>
        <div class="rounded-lg bg-red-100 p-4 text-center">
          <p class="text-sm text-gray-600">{{ t('aqi.unhealthy') }}</p>
          <p class="text-4xl font-bold text-red-600">--</p>
          <p class="text-xs text-gray-500">{{ t('sensors.count', { count: 0 }) }}</p>
        </div>
      </div>
    </section>

    <!-- Sensors List -->
    <section class="rounded-lg bg-white p-4 shadow">
      <h2 class="mb-4 text-xl font-semibold">{{ t('sensors.title') }}</h2>
      <div v-if="loading" class="py-8 text-center">
        <p class="text-gray-500">Loading sensors...</p>
      </div>
      <div v-else-if="sensors.length === 0" class="py-8 text-center">
        <p class="text-gray-500">{{ t('sensors.empty') }}</p>
      </div>
      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <!-- Sensor cards will be rendered here -->
      </div>
    </section>
  </div>
</template>

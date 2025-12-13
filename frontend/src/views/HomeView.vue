<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Placeholder data
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
    <section class="bg-white rounded-lg shadow p-4">
      <h2 class="text-xl font-semibold mb-4">{{ t('map.title') }}</h2>
      <div class="h-96 bg-gray-200 rounded flex items-center justify-center">
        <!-- MapLibre GL JS map will be rendered here -->
        <p class="text-gray-500">Map loading...</p>
      </div>
    </section>

    <!-- AQI Overview -->
    <section class="bg-white rounded-lg shadow p-4">
      <h2 class="text-xl font-semibold mb-4">{{ t('aqi.current') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-green-100 rounded-lg p-4 text-center">
          <p class="text-sm text-gray-600">{{ t('aqi.good') }}</p>
          <p class="text-4xl font-bold text-green-600">--</p>
          <p class="text-xs text-gray-500">{{ t('sensors.count', { count: 0 }) }}</p>
        </div>
        <div class="bg-yellow-100 rounded-lg p-4 text-center">
          <p class="text-sm text-gray-600">{{ t('aqi.moderate') }}</p>
          <p class="text-4xl font-bold text-yellow-600">--</p>
          <p class="text-xs text-gray-500">{{ t('sensors.count', { count: 0 }) }}</p>
        </div>
        <div class="bg-red-100 rounded-lg p-4 text-center">
          <p class="text-sm text-gray-600">{{ t('aqi.unhealthy') }}</p>
          <p class="text-4xl font-bold text-red-600">--</p>
          <p class="text-xs text-gray-500">{{ t('sensors.count', { count: 0 }) }}</p>
        </div>
      </div>
    </section>

    <!-- Sensors List -->
    <section class="bg-white rounded-lg shadow p-4">
      <h2 class="text-xl font-semibold mb-4">{{ t('sensors.title') }}</h2>
      <div v-if="loading" class="text-center py-8">
        <p class="text-gray-500">Loading sensors...</p>
      </div>
      <div v-else-if="sensors.length === 0" class="text-center py-8">
        <p class="text-gray-500">{{ t('sensors.empty') }}</p>
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Sensor cards will be rendered here -->
      </div>
    </section>
  </div>
</template>

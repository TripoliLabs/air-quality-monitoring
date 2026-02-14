<script setup lang="ts">
import { getAqiColor } from '@composables/useAqi';
import { useSensorsStore } from '@stores/sensors';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const store = useSensorsStore();
const { t, locale } = useI18n();

const worstName = computed(() => {
  if (!store.worstNeighborhood) return '--';
  return locale.value === 'ar' ? store.worstNeighborhood.nameAr : store.worstNeighborhood.name;
});

const bestName = computed(() => {
  if (!store.bestNeighborhood) return '--';
  return locale.value === 'ar' ? store.bestNeighborhood.nameAr : store.bestNeighborhood.name;
});

const avgAqiColor = computed(() => getAqiColor(store.averageAqi));

const lastUpdateStr = computed(() => {
  if (!store.lastUpdate) return '--';
  return store.lastUpdate.toLocaleTimeString(locale.value === 'ar' ? 'ar-LB' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 sm:grid-cols-3 lg:grid-cols-5"
  >
    <div class="text-center">
      <p class="text-xs text-gray-500">{{ t('dashboard.activeSensors') }}</p>
      <p class="text-xl font-bold text-emerald-400">{{ store.activeSensorCount }}</p>
    </div>
    <div class="text-center">
      <p class="text-xs text-gray-500">{{ t('dashboard.avgAqi') }}</p>
      <p class="text-xl font-bold" :style="{ color: avgAqiColor }">{{ store.averageAqi }}</p>
    </div>
    <div class="text-center">
      <p class="text-xs text-gray-500">{{ t('dashboard.bestArea') }}</p>
      <p class="truncate text-xl font-bold text-green-400">{{ bestName }}</p>
    </div>
    <div class="text-center">
      <p class="text-xs text-gray-500">{{ t('dashboard.worstArea') }}</p>
      <p class="truncate text-xl font-bold text-red-400">{{ worstName }}</p>
    </div>
    <div class="text-center">
      <p class="text-xs text-gray-500">{{ t('dashboard.lastUpdate') }}</p>
      <p class="text-xl font-bold text-gray-300">{{ lastUpdateStr }}</p>
    </div>
  </div>
</template>

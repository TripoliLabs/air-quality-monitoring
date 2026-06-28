<script setup lang="ts">
import { getAqiCategory, type AqiCategory } from '@composables/useAqi';
import { useSensorsStore } from '@stores/sensors';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const store = useSensorsStore();
const { t } = useI18n();

const categoryLabels: Record<AqiCategory, string> = {
  good: 'aqi.good',
  moderate: 'aqi.moderate',
  unhealthySensitive: 'aqi.unhealthySensitive',
  unhealthy: 'aqi.unhealthy',
  veryUnhealthy: 'aqi.veryUnhealthy',
  hazardous: 'aqi.hazardous',
};

const categoryColors: Record<AqiCategory, string> = {
  good: '#00e400',
  moderate: '#ffff00',
  unhealthySensitive: '#ff7e00',
  unhealthy: '#ff0000',
  veryUnhealthy: '#8f3f97',
  hazardous: '#7e0023',
};

const option = computed(() => {
  const counts: Record<AqiCategory, number> = {
    good: 0,
    moderate: 0,
    unhealthySensitive: 0,
    unhealthy: 0,
    veryUnhealthy: 0,
    hazardous: 0,
  };

  for (const sensor of store.allSensors) {
    if (sensor.latest) {
      const cat = getAqiCategory(sensor.latest.aqi);
      counts[cat]++;
    }
  }

  const data = (Object.keys(counts) as AqiCategory[])
    .filter((cat) => counts[cat] > 0)
    .map((cat) => ({
      name: t(categoryLabels[cat]),
      value: counts[cat],
      itemStyle: { color: categoryColors[cat] },
    }));

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#9ca3af', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#f3f4f6' },
        },
        data,
      },
    ],
  };
});
</script>

<template>
  <VChart :option="option" autoresize style="height: 320px" class="w-full" />
</template>

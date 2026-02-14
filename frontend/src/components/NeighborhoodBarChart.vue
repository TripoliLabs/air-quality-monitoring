<script setup lang="ts">
import { useSensorsStore } from '@stores/sensors';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const store = useSensorsStore();
const { locale } = useI18n();

const option = computed(() => {
  const summaries = [...store.neighborhoodSummaries]
    .filter((n) => n.onlineCount > 0)
    .sort((a, b) => a.avgAqi - b.avgAqi);

  const names = summaries.map((n) =>
    locale.value === 'ar' ? n.nameAr : n.name,
  );
  const values = summaries.map((n) => n.avgAqi);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6', fontSize: 12 },
    },
    grid: { left: 120, right: 30, top: 10, bottom: 25 },
    xAxis: {
      type: 'value',
      name: 'AQI',
      nameTextStyle: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 11 },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 300,
      dimension: 0,
      inRange: {
        color: ['#00e400', '#ffff00', '#ff7e00', '#ff0000', '#8f3f97', '#7e0023'],
      },
    },
    series: [
      {
        type: 'bar',
        data: values,
        barWidth: '60%',
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
});
</script>

<template>
  <VChart :option="option" autoresize style="height: 320px" class="w-full" />
</template>

<script setup lang="ts">
import { useSensorsStore } from '@stores/sensors';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const store = useSensorsStore();
const { locale } = useI18n();

function batteryPercent(mv: number): number {
  return Math.round(Math.min(100, Math.max(0, ((mv - 3200) / 1000) * 100)));
}

function batteryColor(pct: number): string {
  if (pct > 60) return '#22c55e';
  if (pct >= 30) return '#eab308';
  return '#ef4444';
}

const option = computed(() => {
  const sensors = [...store.allSensors]
    .filter((s) => s.latest)
    .map((s) => ({
      name: locale.value === 'ar' ? s.definition.nameAr : s.definition.name,
      pct: batteryPercent(s.latest!.batteryMv),
    }))
    .sort((a, b) => a.pct - b.pct);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6', fontSize: 12 },
      formatter: (params: { name: string; value: number }[]) => {
        const p = params[0];
        return `${p.name}: ${p.value}%`;
      },
    },
    grid: { left: 20, right: 20, top: 10, bottom: 50 },
    xAxis: {
      type: 'category',
      data: sensors.map((s) => s.name),
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 9, rotate: 45, interval: 0 },
    },
    yAxis: {
      type: 'value',
      name: '%',
      max: 100,
      nameTextStyle: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    dataZoom: [
      {
        type: 'slider',
        height: 18,
        bottom: 5,
        borderColor: '#374151',
        backgroundColor: '#111827',
        fillerColor: 'rgba(16,185,129,0.15)',
        handleStyle: { color: '#10b981' },
        textStyle: { color: '#9ca3af' },
      },
    ],
    series: [
      {
        type: 'bar',
        data: sensors.map((s) => ({
          value: s.pct,
          itemStyle: { color: batteryColor(s.pct) },
        })),
        barMaxWidth: 20,
      },
    ],
  };
});
</script>

<template>
  <VChart :option="option" autoresize style="height: 300px" class="w-full" />
</template>

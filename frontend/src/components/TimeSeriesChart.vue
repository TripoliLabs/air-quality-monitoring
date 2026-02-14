<script setup lang="ts">
import { useSensorsStore } from '@stores/sensors';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    sensorId: string;
    height?: string;
    showZoom?: boolean;
  }>(),
  { height: '300px', showZoom: false },
);

const store = useSensorsStore();

const series = computed(() => {
  const sensor = store.getSensorById(props.sensorId);
  if (!sensor) return [];
  return sensor.history;
});

const option = computed(() => {
  const data = series.value;
  const timestamps = data.map((r) => {
    const d = new Date(r.timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
  const pm25 = data.map((r) => r.pm2_5);
  const pm10 = data.map((r) => r.pm10);

  const opt: Record<string, unknown> = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6', fontSize: 12 },
    },
    legend: {
      data: ['PM2.5', 'PM10'],
      textStyle: { color: '#9ca3af' },
      top: 0,
    },
    grid: {
      left: 50,
      right: 20,
      top: 35,
      bottom: props.showZoom ? 60 : 25,
    },
    xAxis: {
      type: 'category',
      data: timestamps,
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      name: 'ug/m3',
      nameTextStyle: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    series: [
      {
        name: 'PM2.5',
        type: 'line',
        data: pm25,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#f59e0b' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245,158,11,0.3)' },
              { offset: 1, color: 'rgba(245,158,11,0.02)' },
            ],
          },
        },
      },
      {
        name: 'PM10',
        type: 'line',
        data: pm10,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#6366f1' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99,102,241,0.3)' },
              { offset: 1, color: 'rgba(99,102,241,0.02)' },
            ],
          },
        },
      },
    ],
  };

  // Include dataZoom slider WITHOUT start/end so user zoom state
  // is preserved across reactive data updates
  if (props.showZoom) {
    opt.dataZoom = [
      {
        type: 'slider',
        height: 20,
        bottom: 5,
        borderColor: '#374151',
        backgroundColor: '#111827',
        fillerColor: 'rgba(16,185,129,0.15)',
        handleStyle: { color: '#10b981' },
        textStyle: { color: '#9ca3af' },
        dataBackground: {
          lineStyle: { color: '#374151' },
          areaStyle: { color: '#1f2937' },
        },
      },
    ];
  }

  return opt;
});
</script>

<template>
  <VChart :option="option" autoresize :style="{ height }" class="w-full" />
</template>

<script setup lang="ts">
import { useSensorsStore } from '@stores/sensors';
import { computed } from 'vue';

const store = useSensorsStore();

const option = computed(() => {
  // Sample every 12th reading from each sensor
  const data: [number, number, number][] = [];

  for (const sensor of store.allSensors) {
    for (let i = 0; i < sensor.history.length; i += 12) {
      const r = sensor.history[i];
      data.push([r.temperature, r.pm2_5, r.aqi]);
    }
  }

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6', fontSize: 12 },
      formatter: (params: { value: number[] }) => {
        const [temp, pm25, aqi] = params.value;
        return `Temp: ${temp.toFixed(1)}°C<br/>PM2.5: ${pm25.toFixed(1)} µg/m³<br/>AQI: ${aqi}`;
      },
    },
    grid: { left: 15, right: 85, top: 20, bottom: 10, containLabel: true },
    xAxis: {
      type: 'value',
      name: '°C',
      nameTextStyle: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    yAxis: {
      type: 'value',
      name: 'PM2.5 µg/m³',
      nameTextStyle: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    visualMap: {
      show: true,
      dimension: 2,
      min: 0,
      max: 300,
      text: ['High AQI', 'Low AQI'],
      textStyle: { color: '#9ca3af' },
      inRange: {
        color: ['#00e400', '#ffff00', '#ff7e00', '#ff0000', '#8f3f97'],
      },
      right: 0,
      top: 'center',
      orient: 'vertical',
      itemWidth: 10,
      itemHeight: 80,
    },
    series: [
      {
        type: 'scatter',
        data,
        symbolSize: 6,
        itemStyle: { opacity: 0.7 },
      },
    ],
  };
});
</script>

<template>
  <VChart :option="option" autoresize style="height: 320px" class="w-full" />
</template>

<script setup lang="ts">
import { useSensorsStore } from '@stores/sensors';
import { computed } from 'vue';

const store = useSensorsStore();

const option = computed(() => {
  // Group all readings by hour of day, average AQI
  const hourBuckets: { sum: number; count: number }[] = Array.from({ length: 24 }, () => ({
    sum: 0,
    count: 0,
  }));

  for (const sensor of store.allSensors) {
    for (const r of sensor.history) {
      const ts = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
      const hour = ts.getHours();
      hourBuckets[hour].sum += r.aqi;
      hourBuckets[hour].count++;
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  const avgAqi = hourBuckets.map((b) => (b.count > 0 ? Math.round(b.sum / b.count) : 0));

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6', fontSize: 12 },
    },
    grid: { left: 15, right: 80, top: 20, bottom: 10, containLabel: true },
    xAxis: {
      type: 'category',
      data: hours,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: 'AQI',
      nameTextStyle: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    series: [
      {
        type: 'line',
        data: avgAqi,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#10b981' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16,185,129,0.3)' },
              { offset: 1, color: 'rgba(16,185,129,0.02)' },
            ],
          },
        },
        markLine: {
          silent: true,
          lineStyle: { type: 'dashed' },
          label: { position: 'end', fontSize: 10 },
          data: [
            {
              yAxis: 50,
              label: { formatter: 'Good', color: '#00e400' },
              lineStyle: { color: '#00e40060' },
            },
            {
              yAxis: 100,
              label: { formatter: 'Moderate', color: '#ffff00' },
              lineStyle: { color: '#ffff0060' },
            },
            {
              yAxis: 150,
              label: { formatter: 'Unhealthy SG', color: '#ff7e00' },
              lineStyle: { color: '#ff7e0060' },
            },
          ],
        },
      },
    ],
  };
});
</script>

<template>
  <VChart :option="option" autoresize style="height: 320px" class="w-full" />
</template>

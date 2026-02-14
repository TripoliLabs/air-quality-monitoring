<script setup lang="ts">
import { useSensorsStore } from '@stores/sensors';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const store = useSensorsStore();
const { t } = useI18n();

const option = computed(() => {
  let online = 0;
  let offline = 0;
  let maintenance = 0;

  for (const sensor of store.allSensors) {
    switch (sensor.definition.status) {
      case 'online':
        online++;
        break;
      case 'offline':
        offline++;
        break;
      case 'maintenance':
        maintenance++;
        break;
    }
  }

  const data = [
    {
      name: t('health.online'),
      value: online,
      itemStyle: { color: '#22c55e' },
    },
    {
      name: t('health.offline'),
      value: offline,
      itemStyle: { color: '#ef4444' },
    },
    {
      name: t('health.maintenance'),
      value: maintenance,
      itemStyle: { color: '#eab308' },
    },
  ].filter((d) => d.value > 0);

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
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#f3f4f6',
          },
        },
        data,
      },
    ],
  };
});
</script>

<template>
  <VChart :option="option" autoresize style="height: 260px" class="w-full" />
</template>

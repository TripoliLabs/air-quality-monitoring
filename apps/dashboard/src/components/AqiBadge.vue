<script setup lang="ts">
import { getAqiColor, getAqiLabel } from '@composables/useAqi';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    aqi: number;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' },
);

const { t } = useI18n();

const color = computed(() => getAqiColor(props.aqi));
const label = computed(() => t(getAqiLabel(props.aqi)));

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-2 py-0.5 text-xs';
    case 'lg':
      return 'px-4 py-2 text-base';
    default:
      return 'px-3 py-1 text-sm';
  }
});

const textColor = computed(() => {
  // Dark text for light backgrounds (good, moderate)
  if (props.aqi <= 100) return '#1a1a1a';
  return '#ffffff';
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold"
    :class="sizeClasses"
    :style="{ backgroundColor: color, color: textColor }"
  >
    <span class="font-bold">{{ aqi }}</span>
    <span>{{ label }}</span>
  </span>
</template>

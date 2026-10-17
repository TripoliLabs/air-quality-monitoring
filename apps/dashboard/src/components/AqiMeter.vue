<script setup lang="ts">
/**
 * The six-step scale with the current level raised. Position carries the
 * meaning as much as colour does, so it reads without colour vision.
 */
import { computed } from 'vue';
import { useLocale } from '../composables/useLocale';
import { AQI_CATEGORIES, aqiCategoryOrNull } from '../lib/aqi';

const props = defineProps<{ aqi: number | null }>();
const { t } = useLocale();
const level = computed(() => aqiCategoryOrNull(props.aqi)?.level ?? 0);
</script>

<template>
  <div
    class="flex h-5 items-end gap-1"
    role="img"
    :aria-label="level ? t('aqi.level', { level }) : t('aqi.names.unknown')"
  >
    <span
      v-for="category in AQI_CATEGORIES"
      :key="category.id"
      class="w-7 rounded-full transition-all duration-500 sm:w-9"
      :class="category.level === level ? 'h-5' : 'h-2'"
      :style="{
        backgroundColor: category.solid,
        opacity: category.level === level ? 1 : 0.38,
        outline: category.level === level ? '2px solid var(--ink)' : 'none',
        outlineOffset: '2px',
      }"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * A piece of sky. Its wash takes on the colour of the current air quality, so
 * the panel reads at a glance before any number does. On the home page the
 * breeze drifts across it too.
 */
import { computed } from 'vue';
import { aqiCategoryOrNull } from '../lib/aqi';
import BreezeCanvas from './BreezeCanvas.vue';

const props = withDefaults(
  defineProps<{
    aqi?: number | null;
    /** Draw moving air over the panel. Home page only. */
    breeze?: boolean;
    /** Square off the corners (full-bleed bands). */
    flush?: boolean;
  }>(),
  { aqi: null, breeze: false, flush: false },
);

const category = computed(() => aqiCategoryOrNull(props.aqi));
const haze = computed(() => (category.value ? (category.value.level - 1) / 5 : null));
const tint = computed(() => category.value?.solid ?? null);
const wash = computed(() => {
  if (!tint.value) return undefined;
  const strength = 14 + (category.value?.level ?? 1) * 4;
  return {
    background: `radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, ${tint.value} ${strength}%, transparent), transparent 62%)`,
  };
});
</script>

<template>
  <div
    class="relative isolate overflow-hidden bg-linear-to-b from-(--sky-top) to-(--sky-bottom)"
    :class="flush ? '' : 'rounded-sky border'"
  >
    <div
      class="absolute inset-0 -z-10 transition-[background] duration-1000 rtl:-scale-x-100"
      :style="wash"
    />
    <BreezeCanvas v-if="breeze" class="-z-10" :haze="haze" :tint="tint" :density="1.25" />
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * The top of every inner page: a slim band of the same sky as the home hero,
 * with a thinner breeze, tinted by the city's current air.
 */
import { storeToRefs } from 'pinia';
import { useAirStore } from '../stores/air';
import SkyPanel from './SkyPanel.vue';

defineProps<{ title: string; intro?: string }>();
const { city } = storeToRefs(useAirStore());
</script>

<template>
  <SkyPanel :aqi="city.aqi" :density="0.45">
    <div
      class="flex flex-col gap-4 px-5 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="min-w-0">
        <slot name="above" />
        <h1 class="text-title">{{ title }}</h1>
        <p v-if="intro" class="mt-2 max-w-2xl text-ink-2">{{ intro }}</p>
      </div>
      <div v-if="$slots.default" class="flex shrink-0 flex-wrap items-center gap-3"><slot /></div>
    </div>
  </SkyPanel>
</template>

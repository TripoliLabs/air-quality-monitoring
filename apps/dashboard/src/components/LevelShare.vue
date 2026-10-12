<script setup lang="ts">
/** How the hours of a period were split across the six AQI levels. */
import { computed } from 'vue';
import { useLocale } from '../composables/useLocale';
import { AQI_CATEGORIES } from '../lib/aqi';

const props = defineProps<{ counts: number[] }>();
const { t, n } = useLocale();

const total = computed(() => props.counts.reduce((a, b) => a + b, 0));
const parts = computed(() =>
  AQI_CATEGORIES.map((category, i) => ({
    category,
    count: props.counts[i] ?? 0,
    share: total.value ? ((props.counts[i] ?? 0) / total.value) * 100 : 0,
  })),
);
</script>

<template>
  <div>
    <div class="flex h-4 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
      <div
        v-for="part in parts"
        :key="part.category.id"
        class="h-full transition-[width] duration-700 ease-out"
        :style="{ width: `${part.share}%`, backgroundColor: part.category.solid }"
      />
    </div>
    <ul class="mt-4 space-y-2 text-sm">
      <li v-for="part in parts" :key="part.category.id" class="flex items-center gap-3">
        <span
          class="num flex size-5 shrink-0 items-center justify-center rounded text-[0.6875rem] font-semibold"
          :style="{ backgroundColor: part.category.solid, color: part.category.onSolid }"
        >
          {{ part.category.level }}
        </span>
        <span class="min-w-0 flex-1 truncate" :class="{ 'text-ink-3': part.count === 0 }">
          {{ t(`aqi.names.${part.category.id}`) }}
        </span>
        <span
          class="num shrink-0 font-medium"
          :class="{ 'font-normal text-ink-3': part.count === 0 }"
        >
          {{ n(part.share, part.share > 0 && part.share < 10 ? 1 : 0) }}%
        </span>
      </li>
    </ul>
  </div>
</template>

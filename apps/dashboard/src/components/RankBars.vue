<script setup lang="ts">
/**
 * A ranked list with proportional bars: neighbourhoods by air quality. Rows are
 * links; the bar grows from the reading edge, so it mirrors in Arabic.
 */
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

export interface RankItem {
  id: string;
  label: string;
  sub?: string;
  /** Null when there is nothing to show (no sensor reporting). */
  value: number | null;
  display: string;
  color: string;
  to?: { name: string; params: Record<string, string> };
}

const props = defineProps<{ items: RankItem[]; unit?: string }>();
const max = computed(() => Math.max(1, ...props.items.map((item) => item.value ?? 0)));
</script>

<template>
  <ol class="divide-y divide-line">
    <li v-for="item in items" :key="item.id">
      <component
        :is="item.to ? 'RouterLink' : 'div'"
        :to="item.to"
        class="group -mx-2 block rounded-lg px-2 py-3"
        :class="{ 'transition-colors hover:bg-sunken': item.to }"
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="min-w-0 truncate font-medium">{{ item.label }}</span>
          <span class="flex shrink-0 items-baseline gap-1.5">
            <span :key="item.display" class="num settle font-semibold">{{ item.display }}</span>
            <span v-if="unit && item.value !== null" class="text-xs text-ink-3">{{ unit }}</span>
            <AppIcon
              v-if="item.to"
              name="chevron"
              directional
              class="self-center text-sm text-ink-3 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            />
          </span>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div
            class="h-full rounded-full transition-[width] duration-700 ease-out"
            :style="{
              width: item.value === null ? '0%' : `${Math.max(3, (item.value / max) * 100)}%`,
              backgroundColor: item.color,
            }"
          />
        </div>
        <p v-if="item.sub" class="mt-1.5 text-xs text-ink-3">{{ item.sub }}</p>
      </component>
    </li>
  </ol>
</template>

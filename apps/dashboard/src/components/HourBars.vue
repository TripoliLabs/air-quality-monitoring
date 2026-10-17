<script setup lang="ts">
/** The typical day: one bar per hour of the clock, coloured by its AQI band. */
import { computed } from 'vue';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';
import type { HourOfDay } from '../lib/stats';

const props = defineProps<{ hours: HourOfDay[] }>();
const { n, t } = useLocale();
const aqi = useAqi();

const max = computed(() => Math.max(1, ...props.hours.map((h) => h.aqi ?? 0)));
const clock = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;
</script>

<template>
  <div dir="ltr">
    <div
      class="flex h-40 items-end gap-[3px] sm:gap-1.5"
      role="img"
      :aria-label="t('trends.dayTitle')"
    >
      <div
        v-for="slot in hours"
        :key="slot.hour"
        class="group relative flex h-full flex-1 items-end"
        :title="
          slot.aqi === null
            ? clock(slot.hour)
            : `${clock(slot.hour)}  ${t('aqi.label')} ${n(slot.aqi)}`
        "
      >
        <div
          class="w-full rounded-t-sm transition-[height] duration-700 ease-out sm:rounded-t"
          :class="{ 'bg-sunken': slot.aqi === null }"
          :style="{
            height: slot.aqi === null ? '3px' : `${Math.max(4, (slot.aqi / max) * 100)}%`,
            backgroundColor: slot.aqi === null ? undefined : aqi.solid(slot.aqi),
          }"
        />
      </div>
    </div>
    <div class="num mt-1.5 flex justify-between text-xs text-ink-3">
      <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
    </div>
  </div>
</template>

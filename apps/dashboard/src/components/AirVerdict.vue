<script setup lang="ts">
/**
 * The headline answer: how the air is, in one word, with the level, the number
 * and what to do about it. Used for the city, a neighbourhood or one sensor.
 */
import { computed } from 'vue';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';
import AqiMeter from './AqiMeter.vue';

const props = defineProps<{
  aqi: number | null;
  /** Shown instead of the verdict while there is nothing to report. */
  waitingTitle: string;
  waitingBody?: string;
  loading?: boolean;
}>();

const { t, n } = useLocale();
const aqiTone = useAqi();
const name = computed(() => aqiTone.name(props.aqi));
// The longest category name ("Unhealthy for sensitive groups") gets a smaller size
// so it sits on two lines, not four.
const long = computed(() => name.value.length > 16);
</script>

<template>
  <div>
    <template v-if="loading">
      <div class="skeleton h-14 w-64 max-w-full sm:h-20" />
      <div class="skeleton mt-5 h-5 w-56 max-w-full" />
      <div class="skeleton mt-5 h-12 w-full max-w-md" />
    </template>

    <template v-else-if="aqi === null">
      <p class="text-title font-semibold">{{ waitingTitle }}</p>
      <p v-if="waitingBody" class="mt-3 max-w-md text-ink-2">{{ waitingBody }}</p>
    </template>

    <template v-else>
      <p
        :key="name"
        class="settle font-semibold"
        :class="long ? 'text-title sm:text-5xl sm:leading-[1.05]' : 'text-display'"
      >
        {{ name }}
      </p>
      <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <AqiMeter :aqi="aqi" />
        <p class="flex items-baseline gap-2">
          <span class="text-sm text-ink-2">{{ t('aqi.label') }}</span>
          <span
            :key="aqi"
            class="num settle text-3xl font-semibold"
            :style="{ color: aqiTone.text(aqi) }"
          >
            {{ n(aqi) }}
          </span>
        </p>
      </div>
      <p class="mt-4 max-w-md text-[1.0625rem]">{{ aqiTone.advice(aqi) }}</p>
    </template>
  </div>
</template>

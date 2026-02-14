<script setup lang="ts">
import { getAqiColor, getAqiLabel } from '@composables/useAqi';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  value: number;
}>();

const { t } = useI18n();

const color = computed(() => getAqiColor(props.value));
const label = computed(() => t(getAqiLabel(props.value)));

// Semicircular arc: SVG path from (10,65) to (110,65), radius 50
// Total arc length = pi * 50 ≈ 157.08
const ARC_LENGTH = Math.PI * 50;
const progress = computed(() => Math.min(props.value / 500, 1));
const dashOffset = computed(() => ARC_LENGTH * (1 - progress.value));
</script>

<template>
  <div class="flex flex-col items-center gap-1 py-2">
    <div class="relative w-full max-w-[200px]">
      <svg viewBox="0 0 120 72" class="w-full">
        <!-- Background arc -->
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke="#1f2937"
          stroke-width="10"
          stroke-linecap="round"
        />
        <!-- Colored progress arc -->
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          :stroke="color"
          stroke-width="10"
          stroke-linecap="round"
          :stroke-dasharray="`${ARC_LENGTH} ${ARC_LENGTH}`"
          :stroke-dashoffset="dashOffset"
          style="transition: stroke-dashoffset 0.6s ease, stroke 0.4s ease"
        />
      </svg>
      <!-- Value centered over the arc -->
      <div class="absolute inset-0 flex items-end justify-center pb-1">
        <span
          class="text-4xl font-bold tabular-nums transition-colors duration-300"
          :style="{ color }"
        >
          {{ value }}
        </span>
      </div>
    </div>
    <span
      class="text-sm font-semibold transition-colors duration-300"
      :style="{ color }"
    >
      {{ label }}
    </span>
  </div>
</template>

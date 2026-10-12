<script setup lang="ts">
/**
 * An AQI value in its colour. The number is always shown, and `label` adds the
 * category name, so the chip never depends on colour alone.
 */
import { computed } from 'vue';
import { useAqi } from '../composables/useAqi';
import { useLocale } from '../composables/useLocale';

const props = withDefaults(
  defineProps<{
    aqi: number | null | undefined;
    label?: boolean;
    size?: 'sm' | 'md' | 'lg';
    /** Greyed: the value is a last reading from a sensor that stopped reporting. */
    stale?: boolean;
  }>(),
  { label: false, size: 'md', stale: false },
);

const { n } = useLocale();
const tone = useAqi();

const shown = computed(() => (props.stale ? null : props.aqi));
const box = computed(
  () =>
    ({
      sm: 'min-w-9 h-6 px-1.5 text-xs',
      md: 'min-w-11 h-7 px-2 text-sm',
      lg: 'min-w-14 h-9 px-2.5 text-lg',
    })[props.size],
);
</script>

<template>
  <span class="inline-flex items-center gap-2 align-middle">
    <span
      class="num inline-flex items-center justify-center rounded-md font-semibold"
      :class="[box, { 'border border-dashed border-ink-3': stale }]"
      :style="
        stale
          ? { color: 'var(--ink-3)' }
          : {
              backgroundColor: tone.solid(shown),
              color: tone.onSolid(shown),
              boxShadow: 'inset 0 0 0 1px rgb(12 34 49 / 0.18)',
            }
      "
    >
      {{ n(props.aqi) }}
    </span>
    <span v-if="label" class="text-sm font-medium" :style="{ color: tone.text(shown) }">
      {{ tone.shortName(shown) }}
    </span>
  </span>
</template>

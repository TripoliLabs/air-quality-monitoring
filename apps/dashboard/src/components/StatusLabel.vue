<script setup lang="ts">
/** Sensor status as a shape plus words: filled dot, hollow ring, or a dash. */
import { useLocale } from '../composables/useLocale';
import type { SensorStatus } from '../types';

defineProps<{ status: SensorStatus }>();
const { t } = useLocale();
</script>

<template>
  <span class="inline-flex items-center gap-2 text-sm whitespace-nowrap">
    <span
      class="inline-block"
      :class="{
        'size-2.5 rounded-full bg-[#2FA35B]': status === 'online',
        'size-2.5 rounded-full border-2 border-danger': status === 'offline',
        'h-0.5 w-2.5 rounded bg-ink-3': status === 'inactive',
      }"
    />
    <span
      :class="
        status === 'online' ? 'text-ink-2' : status === 'offline' ? 'text-danger' : 'text-ink-3'
      "
    >
      {{ t(`status.${status}`) }}
    </span>
  </span>
</template>

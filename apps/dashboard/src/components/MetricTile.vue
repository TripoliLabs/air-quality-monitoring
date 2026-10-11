<script setup lang="ts">
/** One measurement: what it is, its value, its unit. */
defineProps<{ label: string; hint?: string; value: string; unit?: string; color?: string }>();
</script>

<template>
  <div class="min-w-0 py-4 pe-3">
    <dt class="text-sm text-ink-2">
      {{ label }}
      <span v-if="hint" class="text-ink-3">{{ hint }}</span>
    </dt>
    <dd class="mt-1 flex flex-wrap items-baseline gap-x-1.5">
      <span
        :key="value"
        class="num settle text-2xl font-semibold sm:text-3xl"
        :style="color ? { color } : undefined"
      >
        {{ value }}
      </span>
      <span v-if="unit" class="text-sm whitespace-nowrap text-ink-2">{{ unit }}</span>
    </dd>
  </div>
</template>

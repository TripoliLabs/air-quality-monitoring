<script setup lang="ts">
/** Empty, error and not-found states: what happened, and what to do next. */
import AppIcon, { type IconName } from './AppIcon.vue';

defineProps<{ title: string; body?: string; icon?: IconName; tone?: 'neutral' | 'danger' }>();
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center">
    <span
      v-if="icon"
      class="mb-4 flex size-12 items-center justify-center rounded-full bg-sunken text-xl"
      :class="tone === 'danger' ? 'text-danger' : 'text-ink-2'"
    >
      <AppIcon :name="icon" />
    </span>
    <h2 class="text-lg">{{ title }}</h2>
    <p v-if="body" class="mt-2 text-sm text-ink-2">{{ body }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>

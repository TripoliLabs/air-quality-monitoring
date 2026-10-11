<script setup lang="ts" generic="T extends string">
/** A row of exclusive choices. Real radio inputs, so arrows and screen readers just work. */
import { useId } from 'vue';

defineProps<{
  options: { value: T; label: string }[];
  /** Accessible name for the group. */
  label: string;
}>();
const model = defineModel<T>({ required: true });
const group = useId();
</script>

<template>
  <fieldset class="max-w-full min-w-0">
    <legend class="sr-only">{{ label }}</legend>
    <div class="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-control bg-sunken p-1">
      <label
        v-for="option in options"
        :key="option.value"
        class="relative cursor-pointer rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors has-focus-visible:outline-2 has-focus-visible:outline-brand"
        :class="
          model === option.value
            ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(12_34_49/0.14)]'
            : 'text-ink-2 hover:text-ink'
        "
      >
        <input v-model="model" type="radio" class="sr-only" :name="group" :value="option.value" />
        {{ option.label }}
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
/**
 * Says how fresh the page is, in words: live, reconnecting, or polling, and how
 * long ago the last reading arrived. It runs its own one-second clock so the
 * "seconds ago" count moves without re-rendering the rest of the page.
 */
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale } from '../composables/useLocale';
import { useAirStore } from '../stores/air';

defineProps<{ showUpdated?: boolean }>();

const { t, ago } = useLocale();
const store = useAirStore();
const { connection, city } = storeToRefs(store);

const clock = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (clock.value = Date.now()), 1000)));
onBeforeUnmount(() => clearInterval(timer));

const live = computed(() => connection.value === 'live');
const hint = computed(() => t(`connection.${connection.value}Hint`));
const updated = computed(() =>
  city.value.updatedAt
    ? t('connection.updated', { ago: ago(city.value.updatedAt, clock.value) })
    : '',
);
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" role="status">
    <span class="inline-flex items-center gap-2 font-medium" :title="hint">
      <span class="relative flex size-2.5">
        <span
          v-if="live"
          class="absolute inset-0 rounded-full bg-[#2FA35B]"
          style="animation: pulse-ring 2s var(--ease-out-soft) infinite"
        />
        <span
          class="relative size-2.5 rounded-full"
          :class="live ? 'bg-[#2FA35B]' : 'border-2 border-ink-3'"
        />
      </span>
      {{ t(`connection.${connection}`) }}
    </span>
    <span v-if="showUpdated && updated" class="text-ink-2">{{ updated }}</span>
  </div>
</template>

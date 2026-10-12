<script setup lang="ts">
/** Primary navigation on phones: a bar within thumb reach. */
import { useLocale } from '../composables/useLocale';
import { NAV_ITEMS } from '../router';
import AppIcon from './AppIcon.vue';

const { t } = useLocale();
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    :aria-label="t('nav.main')"
  >
    <ul class="mx-auto flex max-w-lg">
      <li v-for="item in NAV_ITEMS" :key="item.name" class="min-w-0 flex-1">
        <RouterLink
          :to="{ name: item.name }"
          class="flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] leading-none text-ink-3"
          active-class="!text-brand font-medium"
        >
          <AppIcon :name="item.icon" class="text-lg" />
          <span class="max-w-full truncate px-0.5">{{ t(item.label) }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

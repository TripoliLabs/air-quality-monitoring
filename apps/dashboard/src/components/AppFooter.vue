<script setup lang="ts">
import { useLocale } from '../composables/useLocale';
import { NAV_ITEMS } from '../router';
import AppIcon from './AppIcon.vue';
import BrandMark from './BrandMark.vue';

const { t } = useLocale();
const REPO = 'https://github.com/TripoliLabs/air-quality-monitoring';
</script>

<template>
  <footer class="mt-16 border-t border-line">
    <div class="shell flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
      <div class="max-w-sm">
        <div class="flex items-center gap-2.5">
          <BrandMark :size="26" />
          <span class="font-semibold">{{ t('app.name') }}</span>
        </div>
        <p class="mt-3 text-sm text-ink-2">{{ t('footer.tagline') }}</p>
        <p class="mt-1 text-sm text-ink-3">{{ t('footer.by') }}</p>
      </div>

      <nav :aria-label="t('nav.main')">
        <ul class="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-ink-2 sm:grid-cols-3">
          <li v-for="item in NAV_ITEMS" :key="item.name">
            <RouterLink :to="{ name: item.name }" class="hover:text-ink">{{
              t(item.label)
            }}</RouterLink>
          </li>
          <li>
            <a
              :href="REPO"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 hover:text-ink"
            >
              {{ t('footer.source') }}
              <AppIcon name="external" class="text-xs" />
            </a>
          </li>
        </ul>
      </nav>
    </div>
    <div class="shell flex flex-col gap-1 pb-8 text-xs text-ink-3 sm:flex-row sm:justify-between">
      <span>{{ t('footer.license') }}</span>
      <span>{{ t('footer.mapCredit') }}</span>
    </div>
  </footer>
</template>

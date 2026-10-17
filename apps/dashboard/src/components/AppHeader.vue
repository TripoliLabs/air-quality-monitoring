<script setup lang="ts">
import { useLocale } from '../composables/useLocale';
import { useTheme } from '../composables/usePrefs';
import { NAV_ITEMS } from '../router';
import AppIcon from './AppIcon.vue';
import BrandMark from './BrandMark.vue';
import LiveIndicator from './LiveIndicator.vue';

const { t, locale, setLocale } = useLocale();
const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/75"
  >
    <div class="shell flex h-14 items-center gap-3 sm:h-16 sm:gap-6">
      <RouterLink
        :to="{ name: 'home' }"
        class="flex items-center gap-2.5"
        :aria-label="t('nav.home')"
      >
        <BrandMark :size="30" />
        <span class="text-lg font-semibold tracking-tight">{{ t('app.name') }}</span>
      </RouterLink>

      <nav class="hidden items-center gap-1 md:flex" :aria-label="t('nav.main')">
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.name"
          :to="{ name: item.name }"
          class="rounded-control px-3 py-2 text-sm text-ink-2 transition-colors hover:text-ink"
          active-class="!text-ink bg-sunken font-medium"
        >
          {{ t(item.label) }}
        </RouterLink>
      </nav>

      <div class="ms-auto flex items-center gap-1 sm:gap-2">
        <LiveIndicator class="me-1 hidden sm:flex" />
        <button
          type="button"
          class="min-h-10 rounded-control px-3 text-sm font-medium transition-colors hover:bg-sunken"
          :lang="locale === 'en' ? 'ar' : 'en'"
          :aria-label="t('nav.switchLanguageLabel')"
          @click="setLocale(locale === 'en' ? 'ar' : 'en')"
        >
          {{ t('nav.switchLanguage') }}
        </button>
        <button
          type="button"
          class="flex size-10 items-center justify-center rounded-control transition-colors hover:bg-sunken"
          :aria-label="isDark ? t('nav.themeToLight') : t('nav.themeToDark')"
          :title="isDark ? t('nav.themeToLight') : t('nav.themeToDark')"
          @click="toggleTheme"
        >
          <AppIcon :name="isDark ? 'sun' : 'moon'" />
        </button>
      </div>
    </div>
  </header>
</template>

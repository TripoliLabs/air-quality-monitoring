/**
 * Reader preferences: language and theme. Both are remembered on the device,
 * and both start from what the browser says the reader wants (an Arabic browser
 * opens in Arabic; a phone in dark mode opens dark).
 *
 * index.html applies the same two choices before the app loads, so the first
 * paint is already in the right language direction and theme.
 */

import { computed, type ComputedRef, ref, watch } from 'vue';
import type { Locale, Theme } from '../types';

const LOCALE_KEY = 'aq.locale';
const THEME_KEY = 'aq.theme';

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode, embedded view)
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered; the choice still applies for this visit.
  }
}

export function initialLocale(): Locale {
  const saved = stored(LOCALE_KEY);
  if (saved === 'en' || saved === 'ar') return saved;
  return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function initialTheme(): Theme {
  const saved = stored(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return systemDark.matches ? 'dark' : 'light';
}

const theme = ref<Theme>(initialTheme());

// Follow the system until the reader picks a theme themselves.
systemDark.addEventListener('change', (event) => {
  if (!stored(THEME_KEY)) theme.value = event.matches ? 'dark' : 'light';
});

watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', value === 'dark' ? '#07161f' : '#eef4f8');
  },
  { immediate: true },
);

export function useTheme(): {
  theme: typeof theme;
  isDark: ComputedRef<boolean>;
  toggleTheme: () => void;
} {
  return {
    theme,
    isDark: computed(() => theme.value === 'dark'),
    toggleTheme: () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark';
      store(THEME_KEY, theme.value);
    },
  };
}

/** Applies a locale to the document and remembers it. */
export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  store(LOCALE_KEY, locale);
}

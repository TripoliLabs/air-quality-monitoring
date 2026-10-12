import { createI18n } from 'vue-i18n';
import type { Locale } from '../types';
import ar from './ar';
import en from './en';

export type MessageSchema = typeof en;

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ar'];
export const RTL_LOCALES: readonly Locale[] = ['ar'];

// Keys are built at run time all over the app (`aqi.names.${id}`), so messages
// are not key-typed; test/i18n.test.ts checks that both languages have every key.
export function createAppI18n(locale: Locale) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: { en, ar },
  });
}

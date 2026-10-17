/**
 * Locale-aware formatting. Dates and relative times follow the language.
 * Numbers are written the same way in both — Western digits with a decimal
 * point, as people in Lebanon write them — so a value reads identically on the
 * map, in a chart and in a sentence, whichever language is on.
 */

import type { Locale } from '../types';

const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-GB',
  ar: 'ar-LB-u-nu-latn',
};

export function intlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}

const NUMBER_LOCALE = 'en-GB';
const numberFormatters = new Map<number, Intl.NumberFormat>();

/** A number with a fixed count of decimals, or an en dash when there is none. */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  let fmt = numberFormatters.get(digits);
  if (!fmt) {
    fmt = new Intl.NumberFormat(NUMBER_LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    numberFormatters.set(digits, fmt);
  }
  return fmt.format(value);
}

export function formatClock(time: number, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(time);
}

export function formatDayTime(time: number, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(time);
}

export function formatDate(time: number | string, locale: Locale): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return '–';
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** "12 seconds ago", "3 minutes ago", "2 hours ago" — in the reader's language. */
export function formatAgo(time: number, now: number, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'always' });
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 60) return rtf.format(-seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 48) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

/** Battery charge from cell voltage: 3.2 V is empty, 4.2 V is full. */
export function batteryPercent(millivolts: number): number {
  return Math.min(100, Math.max(0, Math.round(((millivolts - 3200) / 1000) * 100)));
}

/** URL-safe key for a free-text place name. */
export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'unassigned'
  );
}

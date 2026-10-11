import { computed, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatAgo, formatNumber } from '../lib/format';
import type { MetricId } from '../lib/metrics';
import { METRICS } from '../lib/metrics';
import type { Locale, Sensor } from '../types';
import { applyLocale } from './usePrefs';

/**
 * Everything a component needs to speak the reader's language: translation,
 * number formatting, and the right name for a sensor or place.
 */
export function useLocale() {
  const { t, locale } = useI18n();
  const current = computed(() => locale.value as Locale);
  const isRtl: ComputedRef<boolean> = computed(() => current.value === 'ar');

  function setLocale(next: Locale): void {
    locale.value = next;
    applyLocale(next);
  }

  const n = (value: number | null | undefined, digits = 0): string =>
    formatNumber(value, current.value, digits);

  /** A metric value with the right number of decimals. */
  const metricValue = (id: MetricId, value: number | null | undefined): string =>
    n(value, METRICS[id].digits);

  const metricUnit = (id: MetricId): string =>
    METRICS[id].unit ? t(`units.${METRICS[id].unit}`) : '';

  const ago = (time: number, now: number): string => formatAgo(time, now, current.value);

  const sensorName = (sensor: Pick<Sensor, 'name' | 'nameAr'>): string =>
    (isRtl.value && sensor.nameAr) || sensor.name;

  const placeName = (place: { name: string; nameAr?: string }): string =>
    (isRtl.value && place.nameAr) || place.name;

  const sensorPlace = (sensor: Sensor): string =>
    sensor.neighborhood
      ? (isRtl.value && sensor.neighborhoodAr) || sensor.neighborhood
      : t('sensors.unassigned');

  return {
    t,
    locale: current,
    isRtl,
    setLocale,
    n,
    metricValue,
    metricUnit,
    ago,
    sensorName,
    placeName,
    sensorPlace,
  };
}

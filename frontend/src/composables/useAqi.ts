/**
 * AQI utility composable
 * EPA breakpoints, categories, colors, and PrimeVue severities
 */

import { calculateAQI } from '@mock/simulator';

export type AqiCategory =
  | 'good'
  | 'moderate'
  | 'unhealthySensitive'
  | 'unhealthy'
  | 'veryUnhealthy'
  | 'hazardous';

export function getAqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthySensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'veryUnhealthy';
  return 'hazardous';
}

export function getAqiColor(aqi: number): string {
  const category = getAqiCategory(aqi);
  const colors: Record<AqiCategory, string> = {
    good: '#00e400',
    moderate: '#ffff00',
    unhealthySensitive: '#ff7e00',
    unhealthy: '#ff0000',
    veryUnhealthy: '#8f3f97',
    hazardous: '#7e0023',
  };
  return colors[category];
}

export function getAqiLabel(aqi: number): string {
  const category = getAqiCategory(aqi);
  const labels: Record<AqiCategory, string> = {
    good: 'aqi.good',
    moderate: 'aqi.moderate',
    unhealthySensitive: 'aqi.unhealthySensitive',
    unhealthy: 'aqi.unhealthy',
    veryUnhealthy: 'aqi.veryUnhealthy',
    hazardous: 'aqi.hazardous',
  };
  return labels[category];
}

export function getAqiSeverity(
  aqi: number,
): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
  const category = getAqiCategory(aqi);
  const severities: Record<
    AqiCategory,
    'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
  > = {
    good: 'success',
    moderate: 'warn',
    unhealthySensitive: 'warn',
    unhealthy: 'danger',
    veryUnhealthy: 'danger',
    hazardous: 'contrast',
  };
  return severities[category];
}

export function useAqi() {
  return {
    calculateAQI,
    getAqiCategory,
    getAqiColor,
    getAqiLabel,
    getAqiSeverity,
  };
}

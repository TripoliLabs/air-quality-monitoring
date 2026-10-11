/**
 * The AQI colour and category system — the one place it is defined.
 *
 * Every view reads colours, labels and advice from here, so the scale looks and
 * reads the same on the map, in charts and in text. Colours are tuned for
 * contrast (see test/aqi.test.ts, which checks every pairing against WCAG AA),
 * and a category is never shown by colour alone: it always comes with its level
 * (1–6) or its name.
 */

import type { Theme } from '../types';

export type AqiCategoryId =
  'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'veryUnhealthy' | 'hazardous';

export interface AqiCategory {
  id: AqiCategoryId;
  /** 1 (best) to 6 (worst). */
  level: number;
  /** Lowest and highest AQI in the category. */
  min: number;
  max: number;
  /** Fill for markers, bars and meters; the same in both themes. */
  solid: string;
  /** Text colour that is readable on `solid`. */
  onSolid: string;
  /** Text colour for the category on page surfaces, per theme. */
  text: Record<Theme, string>;
}

export const AQI_CATEGORIES: readonly AqiCategory[] = [
  {
    id: 'good',
    level: 1,
    min: 0,
    max: 50,
    solid: '#2FA35B',
    onSolid: '#04210F',
    text: { light: '#1A7340', dark: '#5FD08A' },
  },
  {
    id: 'moderate',
    level: 2,
    min: 51,
    max: 100,
    solid: '#F2C230',
    onSolid: '#2B2100',
    text: { light: '#7D5B00', dark: '#F2C94C' },
  },
  {
    id: 'sensitive',
    level: 3,
    min: 101,
    max: 150,
    solid: '#F08A24',
    onSolid: '#2E1500',
    text: { light: '#A04A00', dark: '#FFA24D' },
  },
  {
    id: 'unhealthy',
    level: 4,
    min: 151,
    max: 200,
    solid: '#CF2F28',
    onSolid: '#FFFFFF',
    text: { light: '#B8251F', dark: '#FF8076' },
  },
  {
    id: 'veryUnhealthy',
    level: 5,
    min: 201,
    max: 300,
    solid: '#8B46B0',
    onSolid: '#FFFFFF',
    text: { light: '#7A379E', dark: '#CB96EA' },
  },
  {
    id: 'hazardous',
    level: 6,
    min: 301,
    max: 500,
    solid: '#7A1F3D',
    onSolid: '#FFFFFF',
    text: { light: '#7A1F3D', dark: '#F08AAB' },
  },
];

/** Neutral tone for "no data": sensors that have not reported. */
export const AQI_UNKNOWN = {
  solid: '#8A9BA6',
  onSolid: '#0C2231',
  text: { light: '#526B7A', dark: '#8CA5B3' } as Record<Theme, string>,
};

export function aqiCategory(aqi: number): AqiCategory {
  for (const category of AQI_CATEGORIES) {
    if (aqi <= category.max) return category;
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

/** Category for a value that may be missing. */
export function aqiCategoryOrNull(aqi: number | null | undefined): AqiCategory | null {
  return aqi === null || aqi === undefined || Number.isNaN(aqi) ? null : aqiCategory(aqi);
}

export function aqiSolid(aqi: number | null | undefined): string {
  return aqiCategoryOrNull(aqi)?.solid ?? AQI_UNKNOWN.solid;
}

export function aqiOnSolid(aqi: number | null | undefined): string {
  return aqiCategoryOrNull(aqi)?.onSolid ?? AQI_UNKNOWN.onSolid;
}

export function aqiText(aqi: number | null | undefined, theme: Theme): string {
  return (aqiCategoryOrNull(aqi) ?? AQI_UNKNOWN).text[theme];
}

/**
 * US EPA breakpoints, the same tables and rules as the server (packages/domain;
 * test/aqi.test.ts checks the two agree). The server computes the AQI of every
 * reading. This is for values the dashboard derives itself, such as the AQI of
 * an hourly average, so that history and live figures are on the same scale.
 */
interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

// PM2.5 per the 2024 revision (Good ends at 9.0 µg/m³).
const PM25_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 500 },
];

const PM10_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
];

function subIndex(concentration: number, breakpoints: Breakpoint[]): number {
  const bp =
    breakpoints.find((b) => concentration <= b.cHigh) ?? breakpoints[breakpoints.length - 1];
  // Clamp into the band: values between two bands take the upper band's floor,
  // and values above the top band cap at 500.
  const c = Math.min(Math.max(concentration, bp.cLow), bp.cHigh);
  return Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) + bp.iLow);
}

/** AQI sub-index of a PM2.5 concentration (truncated to 0.1 µg/m³, as the EPA specifies). */
export function pm25ToAqi(pm25: number): number {
  return subIndex(Math.floor(Math.max(0, pm25) * 10) / 10, PM25_BREAKPOINTS);
}

/** AQI sub-index of a PM10 concentration (truncated to 1 µg/m³). */
export function pm10ToAqi(pm10: number): number {
  return subIndex(Math.floor(Math.max(0, pm10)), PM10_BREAKPOINTS);
}

/** The overall AQI: the worse of the two particle sub-indices. */
export function particlesToAqi(pm25: number, pm10: number): number {
  return Math.max(pm25ToAqi(pm25), pm10ToAqi(pm10));
}

import type { AqiCategory, AqiResult } from './types';

/** US EPA AQI breakpoints (concentration low/high → index low/high). */
interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

// PM2.5 24-hour breakpoints per the EPA 2024 update (effective 2024-05-06),
// which lowered the bands (Good now ends at 9.0, not 12.0). PM10 is unchanged.
const PM25_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
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
  const c = Math.max(0, concentration);
  const bp = breakpoints.find((b) => c <= b.cHigh) ?? breakpoints[breakpoints.length - 1];
  // Clamp to the band so concentrations above the top breakpoint cap at the
  // band ceiling (EPA AQI maxes at 500) rather than extrapolating past it.
  const cc = Math.min(Math.max(c, bp.cLow), bp.cHigh);
  const idx = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (cc - bp.cLow) + bp.iLow;
  return Math.round(idx);
}

export function aqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy-sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very-unhealthy';
  return 'hazardous';
}

/** Compute the overall AQI as the max of the PM2.5 and PM10 sub-indices. */
export function calculateAqi(pm25: number, pm10: number): AqiResult {
  const pm25Index = subIndex(pm25, PM25_BREAKPOINTS);
  const pm10Index = subIndex(pm10, PM10_BREAKPOINTS);
  const dominantPollutant = pm25Index >= pm10Index ? 'pm25' : 'pm10';
  const aqi = Math.max(pm25Index, pm10Index);
  return { aqi, category: aqiCategory(aqi), dominantPollutant };
}

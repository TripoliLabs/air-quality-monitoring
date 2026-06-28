import { describe, expect, it } from 'vitest';
import { aqiCategory, calculateAqi } from '../src/aqi';

describe('aqiCategory', () => {
  it('maps index ranges to EPA categories', () => {
    expect(aqiCategory(0)).toBe('good');
    expect(aqiCategory(50)).toBe('good');
    expect(aqiCategory(51)).toBe('moderate');
    expect(aqiCategory(100)).toBe('moderate');
    expect(aqiCategory(150)).toBe('unhealthy-sensitive');
    expect(aqiCategory(200)).toBe('unhealthy');
    expect(aqiCategory(300)).toBe('very-unhealthy');
    expect(aqiCategory(301)).toBe('hazardous');
  });
});

describe('calculateAqi', () => {
  it('returns 0 AQI for clean air', () => {
    const r = calculateAqi(0, 0);
    expect(r.aqi).toBe(0);
    expect(r.category).toBe('good');
  });

  it('computes the PM2.5 sub-index at a known breakpoint (12 µg/m³ → 50)', () => {
    // 12.0 is the upper bound of the "good" PM2.5 band.
    expect(calculateAqi(12, 0).aqi).toBe(50);
  });

  it('computes the PM2.5 sub-index at the moderate ceiling (35.4 → 100)', () => {
    expect(calculateAqi(35.4, 0).aqi).toBe(100);
  });

  it('takes the max of the PM2.5 and PM10 sub-indices', () => {
    // Clean PM2.5, dirty PM10 → PM10 dominates.
    const r = calculateAqi(5, 200);
    expect(r.dominantPollutant).toBe('pm10');
    expect(r.aqi).toBeGreaterThan(calculateAqi(5, 0).aqi);
  });

  it('reports PM2.5 as dominant when it drives the index', () => {
    const r = calculateAqi(60, 30);
    expect(r.dominantPollutant).toBe('pm25');
    expect(r.category).toBe('unhealthy');
  });

  it('clamps negative concentrations to 0', () => {
    expect(calculateAqi(-10, -5).aqi).toBe(0);
  });

  it('caps very high concentrations at the top band', () => {
    const r = calculateAqi(600, 700);
    expect(r.aqi).toBe(500);
    expect(r.category).toBe('hazardous');
  });
});

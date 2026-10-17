import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// The server's implementation, imported from source: the dashboard's copy must agree with it.
import { calculateAqi } from '../../../packages/domain/src/aqi';
import {
  AQI_CATEGORIES,
  AQI_UNKNOWN,
  aqiCategory,
  particlesToAqi,
  pm25ToAqi,
} from '../src/lib/aqi';

/** WCAG 2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The theme tokens, read from the stylesheet so the test checks the real colours. */
function themeTokens(): Record<'light' | 'dark', Record<string, string>> {
  const css = readFileSync(join(__dirname, '../src/style.css'), 'utf8');
  const block = (selector: string): Record<string, string> => {
    const body = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    return Object.fromEntries(
      [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
    );
  };
  return { light: block(':root'), dark: block("[data-theme='dark']") };
}

const AA_TEXT = 4.5;
const tokens = themeTokens();
const SURFACES = ['bg', 'surface', 'sunken', 'raised'];

describe('theme tokens', () => {
  it('are read from the stylesheet', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const name of [...SURFACES, 'ink', 'ink-2', 'ink-3', 'brand', 'on-brand']) {
        expect(tokens[theme][name], `${theme} --${name}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it.each(['light', 'dark'] as const)('text colours meet WCAG AA on every %s surface', (theme) => {
    for (const ink of ['ink', 'ink-2', 'ink-3', 'brand', 'danger']) {
      for (const surface of SURFACES) {
        expect(
          contrast(tokens[theme][ink], tokens[theme][surface]),
          `${theme}: --${ink} on --${surface}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
    expect(contrast(tokens[theme]['on-brand'], tokens[theme].brand)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});

describe('AQI colours', () => {
  const tones = [...AQI_CATEGORIES, { id: 'unknown', ...AQI_UNKNOWN }];

  it.each(tones)('$id: text on its fill meets WCAG AA', (tone) => {
    expect(contrast(tone.onSolid, tone.solid)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(tones)('$id: category text meets WCAG AA on every surface, both themes', (tone) => {
    for (const theme of ['light', 'dark'] as const) {
      for (const surface of SURFACES) {
        expect(
          contrast(tone.text[theme], tokens[theme][surface]),
          `${theme}: ${tone.id} text on --${surface}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });
});

describe('AQI categories', () => {
  it('cover 0–500 without gaps and number the levels 1–6', () => {
    expect(AQI_CATEGORIES.map((c) => c.level)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(AQI_CATEGORIES[0].min).toBe(0);
    for (let i = 1; i < AQI_CATEGORIES.length; i++) {
      expect(AQI_CATEGORIES[i].min).toBe(AQI_CATEGORIES[i - 1].max + 1);
    }
  });

  it.each([
    [0, 'good'],
    [50, 'good'],
    [51, 'moderate'],
    [100, 'moderate'],
    [101, 'sensitive'],
    [150, 'sensitive'],
    [151, 'unhealthy'],
    [200, 'unhealthy'],
    [201, 'veryUnhealthy'],
    [300, 'veryUnhealthy'],
    [301, 'hazardous'],
    [999, 'hazardous'],
  ])('AQI %i is %s', (aqi, id) => {
    expect(aqiCategory(aqi).id).toBe(id);
  });
});

describe('pm25ToAqi', () => {
  it.each([
    [0, 0],
    [9.0, 50],
    [9.1, 51],
    [35.4, 100],
    [35.5, 101],
    [55.4, 150],
    [125.4, 200],
    [225.4, 300],
    [325.4, 500],
    [900, 500],
  ])('%f µg/m³ → AQI %i', (pm25, aqi) => {
    expect(pm25ToAqi(pm25)).toBe(aqi);
  });

  it('never decreases as PM2.5 rises, including between breakpoints', () => {
    let previous = 0;
    for (let pm = 0; pm <= 330; pm += 0.05) {
      const aqi = pm25ToAqi(pm);
      expect(aqi).toBeGreaterThanOrEqual(previous);
      previous = aqi;
    }
  });

  it('treats a negative reading as zero', () => {
    expect(pm25ToAqi(-3)).toBe(0);
  });
});

describe('AQI calculation matches the server', () => {
  it('gives the same index as @aq/domain across the whole range of both particles', () => {
    const pm25Values = [
      0, 4.5, 9.0, 9.05, 9.09, 9.1, 12, 35.4, 35.45, 35.5, 55.4, 55.5, 90, 125.4, 125.5, 200, 225.5,
      325.4, 400, 6553.5,
    ];
    const pm10Values = [
      0, 20, 54, 54.9, 55, 100, 154, 155, 254, 255, 300, 354, 355, 424, 425, 604, 900,
    ];
    for (const pm25 of pm25Values) {
      for (const pm10 of pm10Values) {
        expect(particlesToAqi(pm25, pm10), `pm25=${pm25} pm10=${pm10}`).toBe(
          calculateAqi(pm25, pm10).aqi,
        );
      }
    }
  });

  it('lets coarse dust set the index when it is the worse of the two', () => {
    // A dust event: little smoke, a lot of dust.
    expect(particlesToAqi(30, 300)).toBe(calculateAqi(30, 300).aqi);
    expect(particlesToAqi(30, 300)).toBeGreaterThan(pm25ToAqi(30));
  });
});

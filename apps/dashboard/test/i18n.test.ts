import { describe, expect, it } from 'vitest';
import ar from '../src/i18n/ar';
import en from '../src/i18n/en';
import { AQI_CATEGORIES } from '../src/lib/aqi';
import { METRIC_ORDER } from '../src/lib/metrics';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...out, [path]: value }
      : { ...out, ...flatten(value, path) };
  }, {});
}

const english = flatten(en);
const arabic = flatten(ar);
// English may repeat a placeholder across its singular and plural forms.
const placeholders = (text: string): string[] =>
  [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

describe('translations', () => {
  it('Arabic has every English key and no extras', () => {
    expect(Object.keys(arabic).sort()).toEqual(Object.keys(english).sort());
  });

  it('no message is empty', () => {
    for (const [key, text] of [...Object.entries(english), ...Object.entries(arabic)]) {
      expect(text.trim(), key).not.toBe('');
    }
  });

  it('both languages use the same placeholders in each message', () => {
    for (const key of Object.keys(english)) {
      expect(placeholders(arabic[key]), key).toEqual(placeholders(english[key]));
    }
  });

  it('every AQI category and metric has its strings', () => {
    for (const { id } of AQI_CATEGORIES) {
      for (const group of ['names', 'short', 'advice']) {
        expect(english[`aqi.${group}.${id}`], `aqi.${group}.${id}`).toBeTruthy();
      }
    }
    for (const id of METRIC_ORDER) {
      expect(english[`metrics.${id}.name`]).toBeTruthy();
      expect(english[`metrics.${id}.short`]).toBeTruthy();
    }
  });
});

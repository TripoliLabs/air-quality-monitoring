/**
 * The metric registry: what the network measures and how each value is shown.
 *
 * The map layers, the reading tiles, the charts and the data export are all
 * driven by this list. Supporting a new measurement (say NO₂ or CO₂) means
 * adding the field to `Reading`, adding one entry here and its two translation
 * strings — no view needs to change.
 */

import type { HourlyPoint, Reading } from '../types';
import { aqiSolid, particlesToAqi, pm10ToAqi, pm25ToAqi } from './aqi';

export type MetricId = 'aqi' | 'pm25' | 'pm10' | 'temperature' | 'humidity';

export interface MetricDef {
  id: MetricId;
  /** i18n keys: `metrics.<id>.name`, `metrics.<id>.short`. */
  /** Unit shown after the value; an i18n key under `units`. Empty for unitless. */
  unit: 'ugm3' | 'celsius' | 'percent' | '';
  /** Decimal places when displayed. */
  digits: number;
  /** Value from a single reading. */
  value: (r: Reading) => number | undefined;
  /** Value from an hourly aggregate. */
  hourly: (h: HourlyPoint) => number;
  /** Colour for a value: a map marker, a bar, a chart line. */
  color: (v: number) => string;
  /** Typical range, used for chart axes and legends. */
  range: [number, number];
}

type Stop = [value: number, hex: string];

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear interpolation across colour stops, clamped at both ends. */
export function ramp(stops: Stop[]): (v: number) => string {
  return (v: number): string => {
    if (v <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      const [hi, hiHex] = stops[i];
      if (v <= hi) {
        const [lo, loHex] = stops[i - 1];
        const t = (v - lo) / (hi - lo);
        const a = hexToRgb(loHex);
        const b = hexToRgb(hiHex);
        const mix = a.map((c, k) => Math.round(c + (b[k] - c) * t));
        return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
      }
    }
    return stops[stops.length - 1][1];
  };
}

export const METRICS: Record<MetricId, MetricDef> = {
  aqi: {
    id: 'aqi',
    unit: '',
    digits: 0,
    value: (r) => r.aqi,
    hourly: (h) => particlesToAqi(h.pm25, h.pm10),
    color: (v) => aqiSolid(v),
    range: [0, 200],
  },
  pm25: {
    id: 'pm25',
    unit: 'ugm3',
    digits: 1,
    value: (r) => r.pm25,
    hourly: (h) => h.pm25,
    color: (v) => aqiSolid(pm25ToAqi(v)),
    range: [0, 80],
  },
  pm10: {
    id: 'pm10',
    unit: 'ugm3',
    digits: 1,
    value: (r) => r.pm10,
    hourly: (h) => h.pm10,
    color: (v) => aqiSolid(pm10ToAqi(v)),
    range: [0, 150],
  },
  temperature: {
    id: 'temperature',
    unit: 'celsius',
    digits: 1,
    value: (r) => r.temperature,
    hourly: (h) => h.temperature,
    color: ramp([
      [0, '#3D7EC7'],
      [15, '#6FB7D9'],
      [24, '#E9D27A'],
      [32, '#EE9440'],
      [42, '#C8392F'],
    ]),
    range: [0, 42],
  },
  humidity: {
    id: 'humidity',
    unit: 'percent',
    digits: 0,
    value: (r) => r.humidity,
    hourly: (h) => h.humidity,
    color: ramp([
      [0, '#E3D9A8'],
      [50, '#6FB7D9'],
      [100, '#0A4F8C'],
    ]),
    range: [0, 100],
  },
};

/** Display order wherever metrics are listed. */
export const METRIC_ORDER: readonly MetricId[] = ['aqi', 'pm25', 'pm10', 'temperature', 'humidity'];

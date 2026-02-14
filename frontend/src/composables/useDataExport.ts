/**
 * Data export composable
 * Generates CSV/JSON exports from sensor history data
 */

import type { SensorTimeSeries } from '@stores/sensors';

interface ExportReading {
  sensorId: string;
  sensorName: string;
  neighborhood: string;
  timestamp: string;
  pm2_5: number;
  pm10: number;
  temperature: number;
  humidity: number;
  aqi: number;
  batteryMv: number;
  signalStrength: number;
}

function flattenReadings(
  sensors: SensorTimeSeries[],
  fromDate: Date | null,
  toDate: Date | null,
  locale: string,
): ExportReading[] {
  const rows: ExportReading[] = [];

  for (const sensor of sensors) {
    const name =
      locale === 'ar' ? sensor.definition.nameAr : sensor.definition.name;
    const neighborhood =
      locale === 'ar'
        ? sensor.definition.location.neighborhoodAr
        : sensor.definition.location.neighborhood;

    for (const r of sensor.history) {
      const ts = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
      if (fromDate && ts < fromDate) continue;
      if (toDate && ts > toDate) continue;

      rows.push({
        sensorId: sensor.definition.id,
        sensorName: name,
        neighborhood,
        timestamp: ts.toISOString(),
        pm2_5: r.pm2_5,
        pm10: r.pm10,
        temperature: r.temperature,
        humidity: r.humidity,
        aqi: r.aqi,
        batteryMv: r.batteryMv,
        signalStrength: r.signalStrength,
      });
    }
  }

  return rows;
}

export function generateCSV(
  sensors: SensorTimeSeries[],
  fromDate: Date | null,
  toDate: Date | null,
  locale: string,
): string {
  const rows = flattenReadings(sensors, fromDate, toDate, locale);
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]) as (keyof ExportReading)[];
  const lines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h];
      if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
      return String(v);
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

export function generateJSON(
  sensors: SensorTimeSeries[],
  fromDate: Date | null,
  toDate: Date | null,
  locale: string,
): string {
  const rows = flattenReadings(sensors, fromDate, toDate, locale);
  return JSON.stringify(rows, null, 2);
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function countReadings(
  sensors: SensorTimeSeries[],
  fromDate: Date | null,
  toDate: Date | null,
): number {
  let count = 0;
  for (const sensor of sensors) {
    for (const r of sensor.history) {
      const ts = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
      if (fromDate && ts < fromDate) continue;
      if (toDate && ts > toDate) continue;
      count++;
    }
  }
  return count;
}

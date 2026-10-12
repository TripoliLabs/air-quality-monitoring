/** Turning readings into downloadable files. Pure except for `downloadFile`. */

import type { HourlyPoint, Reading, Sensor } from '../types';

export type ExportRow = Record<string, string | number>;

function sensorColumns(sensor: Sensor): ExportRow {
  return {
    device_id: sensor.id,
    sensor: sensor.name,
    neighborhood: sensor.neighborhood ?? '',
    latitude: sensor.latitude,
    longitude: sensor.longitude,
  };
}

export function readingRows(sensor: Sensor, readings: Reading[]): ExportRow[] {
  return readings.map((r) => ({
    ...sensorColumns(sensor),
    time: new Date(r.time).toISOString(),
    aqi: r.aqi,
    pm25_ugm3: r.pm25,
    pm10_ugm3: r.pm10,
    temperature_c: r.temperature,
    humidity_percent: r.humidity,
    pressure_hpa: r.pressure ?? '',
    battery_mv: r.batteryMv ?? '',
    signal_dbm: r.signalStrength ?? '',
  }));
}

export function hourlyRows(sensor: Sensor, points: HourlyPoint[]): ExportRow[] {
  return points.map((p) => ({
    ...sensorColumns(sensor),
    hour_start: new Date(p.time).toISOString(),
    avg_pm25_ugm3: p.pm25,
    avg_pm10_ugm3: p.pm10,
    avg_temperature_c: p.temperature,
    avg_humidity_percent: p.humidity,
    max_aqi: p.maxAqi,
    samples: p.samples,
  }));
}

/** RFC 4180: quote a field that holds a comma, a quote or a line break. */
function csvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) => headers.map((h) => csvField(row[h] ?? '')).join(','));
  return [headers.join(','), ...lines].join('\r\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  // The byte-order mark makes Excel read the UTF-8 (Arabic names) correctly.
  const body = mimeType.startsWith('text/csv') ? String.fromCharCode(0xfeff) + content : content;
  const url = URL.createObjectURL(new Blob([body], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

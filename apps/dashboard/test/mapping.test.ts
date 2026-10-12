import { describe, expect, it } from 'vitest';
import { hourlyRows, readingRows, toCsv } from '../src/lib/export';
import { arabicPlaceName } from '../src/lib/places';
import { toReading, toSensor } from '../src/services/http-sensor-service';

describe('API mapping', () => {
  it('maps a sensor, normalising the device ID and adding the Arabic place name', () => {
    const sensor = toSensor({
      id: 'uuid',
      deviceId: '2CBCBBFFFEA945C4',
      name: 'Mina rooftop',
      latitude: 34.45,
      longitude: 35.82,
      neighborhood: 'El Mina',
      isActive: true,
    });
    expect(sensor.id).toBe('2cbcbbfffea945c4');
    expect(sensor.neighborhoodId).toBe('el-mina');
    expect(sensor.neighborhoodAr).toBe('الميناء');
  });

  it('keeps a sensor with no neighbourhood', () => {
    const sensor = toSensor({
      id: 'u',
      deviceId: 'ab',
      name: 'x',
      latitude: 0,
      longitude: 0,
      isActive: false,
    });
    expect(sensor.neighborhood).toBeNull();
    expect(sensor.neighborhoodId).toBe('unassigned');
  });

  it('reads both reading shapes: stored rows (`time`) and live events (`timestamp`)', () => {
    const base = { pm25: 12, pm10: 20, temperature: 21, humidity: 55, aqi: 57 };
    const stored = toReading({
      ...base,
      sensorId: 'AB',
      time: '2026-10-11T10:00:00.000Z',
      batteryMv: null,
    });
    const live = toReading({
      ...base,
      deviceId: 'ab',
      timestamp: '2026-10-11T10:00:00Z',
      batteryMv: 3900,
    });
    expect(stored).toMatchObject({
      sensorId: 'ab',
      time: Date.UTC(2026, 9, 11, 10),
      batteryMv: undefined,
    });
    expect(live).toMatchObject({
      sensorId: 'ab',
      time: Date.UTC(2026, 9, 11, 10),
      batteryMv: 3900,
    });
  });

  it('drops a reading with no usable time or sensor', () => {
    const base = { pm25: 1, pm10: 1, temperature: 1, humidity: 1, aqi: 1 };
    expect(toReading({ ...base, sensorId: 'ab' })).toBeNull();
    expect(toReading({ ...base, time: '2026-10-11T10:00:00Z' })).toBeNull();
  });
});

describe('place names', () => {
  it.each(['El Mina', 'Al-Mina', 'mina', 'EL-MINA'])('finds the Arabic name for "%s"', (name) => {
    expect(arabicPlaceName(name)).toBe('الميناء');
  });

  it('returns undefined for a place it does not know', () => {
    expect(arabicPlaceName('Somewhere New')).toBeUndefined();
  });
});

describe('export', () => {
  const sensor = toSensor({
    id: 'u',
    deviceId: 'ab',
    name: 'Roof, north "A"',
    latitude: 34.4,
    longitude: 35.8,
    neighborhood: 'Tell',
    isActive: true,
  });

  it('quotes CSV fields that contain commas or quotes', () => {
    const csv = toCsv(
      readingRows(sensor, [
        {
          sensorId: 'ab',
          time: Date.UTC(2026, 9, 11, 10),
          pm25: 12.5,
          pm10: 20,
          temperature: 21,
          humidity: 55,
          aqi: 58,
        },
      ]),
    );
    const [header, line] = csv.split('\r\n');
    expect(header.split(',').slice(0, 3)).toEqual(['device_id', 'sensor', 'neighborhood']);
    expect(line).toContain('"Roof, north ""A"""');
    expect(line).toContain('2026-10-11T10:00:00.000Z');
  });

  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
    expect(hourlyRows(sensor, [])).toEqual([]);
  });
});

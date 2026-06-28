import { describe, expect, it } from 'vitest';
import { ChirpStackUplinkSchema, ReadingCreatedEventSchema, SensorReadingSchema } from '../src/index';

describe('SensorReadingSchema', () => {
  const valid = {
    deviceId: '70b3d57ed0060001',
    timestamp: '2026-06-27T21:30:41.784Z',
    pm25: 42.3,
    pm10: 78.5,
    temperature: 24.5,
    humidity: 61,
  };

  it('accepts a valid reading', () => {
    expect(SensorReadingSchema.parse(valid)).toMatchObject({ deviceId: '70b3d57ed0060001' });
  });

  it('rejects pm2.5 out of range', () => {
    expect(() => SensorReadingSchema.parse({ ...valid, pm25: 2000 })).toThrow();
  });

  it('rejects an invalid timestamp', () => {
    expect(() => SensorReadingSchema.parse({ ...valid, timestamp: 'not-a-date' })).toThrow();
  });

  it('rejects impossible humidity', () => {
    expect(() => SensorReadingSchema.parse({ ...valid, humidity: 120 })).toThrow();
  });
});

describe('ChirpStackUplinkSchema', () => {
  it('parses a ChirpStack v4 uplink and ignores unknown fields', () => {
    const uplink = {
      deduplicationId: 'abc',
      deviceInfo: { devEui: '70b3d57ed0060002', deviceName: 'Tell', applicationId: 'app-1' },
      fPort: 2,
      fCnt: 7,
      data: Buffer.from([1, 2, 3]).toString('base64'),
      time: '2026-06-27T21:30:41.784Z',
      rxInfo: [{ gatewayId: 'ac1f09fffe000101', rssi: -74, snr: 7.5 }],
      somethingUnknown: true,
    };
    const parsed = ChirpStackUplinkSchema.parse(uplink);
    expect(parsed.deviceInfo.devEui).toBe('70b3d57ed0060002');
    expect(parsed.rxInfo?.[0]?.rssi).toBe(-74);
  });

  it('requires devEui and data', () => {
    expect(() => ChirpStackUplinkSchema.parse({ deviceInfo: {}, data: 'x' })).toThrow();
  });
});

describe('ReadingCreatedEventSchema', () => {
  it('validates a realtime event payload', () => {
    const event = {
      type: 'reading.created' as const,
      payload: {
        deviceId: 'd1',
        sensorId: 'd1',
        timestamp: '2026-06-27T21:30:41.784Z',
        pm25: 10,
        pm10: 15,
        temperature: 20,
        humidity: 50,
        id: 'd1:ts',
        aqi: 42,
        aqiCategory: 'good',
      },
    };
    expect(ReadingCreatedEventSchema.parse(event).type).toBe('reading.created');
  });
});

import { describe, expect, it } from 'vitest';
import {
  ChirpStackUplinkSchema,
  CreateSensorSchema,
  ReadingCreatedEventSchema,
  SensorReadingSchema,
  UpdateSensorSchema,
} from '../src/index';

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

  it('accepts extreme dust-storm PM2.5 (up to the codec wire ceiling)', () => {
    expect(SensorReadingSchema.parse({ ...valid, pm25: 2000 }).pm25).toBe(2000);
  });

  it('rejects pm2.5 above the wire ceiling', () => {
    expect(() => SensorReadingSchema.parse({ ...valid, pm25: 7000 })).toThrow();
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

describe('CreateSensorSchema & UpdateSensorSchema', () => {
  it('accepts a valid sensor creation payload and normalises DevEUI to lowercase', () => {
    const valid = {
      deviceId: '2CBCBBFFFEA945C4',
      name: 'Tripoli Port',
      latitude: 34.455,
      longitude: 35.823,
      neighborhood: 'El Mina',
    };
    const parsed = CreateSensorSchema.parse(valid);
    expect(parsed.deviceId).toBe('2cbcbbfffea945c4');
    expect(parsed.status).toBe('active');
    expect(parsed.isSimulated).toBe(false);
  });

  it('rejects an invalid DevEUI (not 16 hex chars)', () => {
    expect(() =>
      CreateSensorSchema.parse({
        deviceId: 'invalid-dev-eui',
        name: 'Invalid Node',
        latitude: 34.4,
        longitude: 35.8,
      }),
    ).toThrow();
  });

  it('rejects out-of-range coordinates', () => {
    expect(() =>
      CreateSensorSchema.parse({
        deviceId: '2cbcbbfffea945c4',
        name: 'Bad Lat',
        latitude: 95.0,
        longitude: 35.8,
      }),
    ).toThrow();
  });

  it('accepts partial updates via UpdateSensorSchema', () => {
    const update = {
      status: 'maintenance' as const,
      neighborhood: 'Tripoli Center',
    };
    const parsed = UpdateSensorSchema.parse(update);
    expect(parsed.status).toBe('maintenance');
    expect(parsed.neighborhood).toBe('Tripoli Center');
  });
});

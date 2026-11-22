import { describe, expect, it } from 'vitest';
import { configurationRoute } from '../src/ingestion/configuration-routing';

describe('configuration routing', () => {
  const app = '00000000-0000-0000-0000-000000000001';
  const topic = `application/${app}/device/AAAAAAAA00000001/event/up`;
  it('normalizes the envelope and topic DevEUI and uses the actual topic application', () => {
    expect(
      configurationRoute(topic, { deviceInfo: { devEui: 'aaaaaaaa00000001' }, data: '' }),
    ).toEqual({ deviceId: 'aaaaaaaa00000001', applicationId: app });
  });
  it('rejects inconsistent application/device identities and guessed routing', () => {
    expect(() =>
      configurationRoute(topic, { deviceInfo: { devEui: 'aaaaaaaa00000002' }, data: '' }),
    ).toThrow();
    expect(() =>
      configurationRoute(topic, {
        deviceInfo: {
          devEui: 'aaaaaaaa00000001',
          applicationId: '00000000-0000-0000-0000-000000000002',
        },
        data: '',
      }),
    ).toThrow();
    expect(() =>
      configurationRoute(topic.replace(app, 'airquality'), {
        deviceInfo: { devEui: 'aaaaaaaa00000001' },
        data: '',
      }),
    ).toThrow();
  });
  it.each([
    'application/+/device/aaaaaaaa00000001/event/up',
    'application/airquality/device/aaaaaaaa00000001/event/up',
    `application/${app}/device/not-a-dev-eui/event/up`,
    `application/${app}/device/aaaaaaaa00000001/command/down`,
  ])('rejects malformed routing topic %s', (candidate) => {
    expect(() =>
      configurationRoute(candidate, { deviceInfo: { devEui: 'aaaaaaaa00000001' }, data: '' }),
    ).toThrow();
  });
});

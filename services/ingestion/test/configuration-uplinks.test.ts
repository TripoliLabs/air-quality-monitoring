import 'reflect-metadata';
import { ConfigResult, encodeConfigReport, encodeUplink } from '@aq/telemetry-codec';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IngestionService } from '../src/ingestion/ingestion.service';

describe('configuration routing from validated uplinks', () => {
  const device = 'aaaaaaaa00000001';
  const app = '00000000-0000-0000-0000-000000000001';
  const topic = `application/${app}/device/${device}/event/up`;
  afterEach(() => vi.restoreAllMocks());
  function fixture() {
    const redis = { set: vi.fn().mockResolvedValue('OK'), publish: vi.fn().mockResolvedValue(1) };
    const report = vi.fn().mockResolvedValue(undefined);
    const persist = vi.fn().mockResolvedValue(undefined);
    const instance = Object.assign(Object.create(IngestionService.prototype), {
      redis,
      configuration: { report },
      db: { insert: () => ({ values: () => ({ onConflictDoNothing: persist }) }) },
      log: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
      readingsDropped: { add: vi.fn() },
      readingsIngested: { add: vi.fn() },
    }) as { handleUplink: (topic: string, raw: Buffer) => Promise<void> };
    const send = (fPort: number, bytes: Uint8Array, time?: string, override = {}) =>
      instance.handleUplink(
        topic,
        Buffer.from(
          JSON.stringify({
            deviceInfo: { devEui: device, applicationId: app },
            fPort,
            data: Buffer.from(bytes).toString('base64'),
            time,
            ...override,
          }),
        ),
      );
    return { redis, report, persist, send };
  }
  it.each([
    ['ordinary', 0x31],
    ['partial', 0x11],
    ['heartbeat', 0x01],
  ] as const)('caches routing from a valid %s telemetry frame', async (_, flags) => {
    const { redis, persist, send } = fixture();
    const bytes = encodeUplink({
      pm25: 10,
      pm10: 20,
      temperature: 20,
      humidity: 50,
      pressure: 1000,
      batteryMv: 3800,
    });
    bytes[12] = flags;
    await send(2, bytes);
    expect(redis.set).toHaveBeenCalledWith(`sensor:application:${device}`, app);
    expect(persist).toHaveBeenCalledTimes(flags === 0x31 ? 1 : 0);
  });
  const reportBytes = encodeConfigReport({
    intervalS: 300,
    pmOffsetX10: -12,
    tempOffsetX100: -123,
    lastResult: ConfigResult.Applied,
    lastCommand: 3,
  });
  it('caches report routing and normalizes source timestamps', async () => {
    const { redis, report, send } = fixture();
    await send(11, reportBytes, '2026-01-01T10:00:00.123456Z');
    expect(redis.set).toHaveBeenCalledWith(`sensor:application:${device}`, app);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        pmOffset: -1.2,
        temperatureOffset: -1.23,
        reportedAt: '2026-01-01T10:00:00.123Z',
      }),
      true,
    );
  });
  it.each([undefined, 'invalid', '2099-01-01T00:00:00Z'])(
    'marks unusable source time untrusted: %s',
    async (time) => {
      const { report, send } = fixture();
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      await send(11, reportBytes, time);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ reportedAt: new Date(now).toISOString() }),
        false,
      );
    },
  );
  it.each([
    [2, new Uint8Array(2)],
    [11, new Uint8Array(8)],
    [11, new Uint8Array(9).fill(255)],
    [12, reportBytes],
  ] as const)(
    'does not cache routing for malformed/unsupported fPort %s frames',
    async (fPort, bytes) => {
      const { redis, report, send } = fixture();
      await send(fPort, bytes);
      expect(redis.set).not.toHaveBeenCalled();
      expect(report).not.toHaveBeenCalled();
    },
  );
  it('does not cache routing for mismatched topic/envelope identities', async () => {
    const { redis, send } = fixture();
    await send(11, reportBytes, undefined, {
      deviceInfo: { devEui: 'aaaaaaaa00000002', applicationId: app },
    });
    expect(redis.set).not.toHaveBeenCalled();
  });
});

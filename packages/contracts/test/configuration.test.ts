import { describe, expect, it } from 'vitest';
import {
  ConfigurationCommandSchema,
  ConfigurationJobSchema,
  ReportedConfigurationSchema,
  configurationTarget,
  configurationWireCommand,
} from '../src/configuration';

describe('configuration contracts', () => {
  it.each([
    { command: 'setInterval', seconds: 120 },
    { command: 'setInterval', seconds: 21600 },
    { command: 'setPmOffset', pmOffset: -50 },
    { command: 'setPmOffset', pmOffset: 50 },
    { command: 'setTempOffset', temperatureOffset: -10 },
    { command: 'setTempOffset', temperatureOffset: 10 },
    { command: 'setPmOffset', pmOffset: 0.1 + 0.2 },
  ])('accepts exact hardware boundary/representable value %j', (command) => {
    expect(ConfigurationCommandSchema.safeParse(command).success).toBe(true);
  });
  it.each([
    { command: 'setInterval', seconds: 119 },
    { command: 'setInterval', seconds: 21601 },
    { command: 'setInterval', seconds: 120.1 },
    { command: 'setPmOffset', pmOffset: -50.1 },
    { command: 'setPmOffset', pmOffset: 50.1 },
    { command: 'setPmOffset', pmOffset: 1.23 },
    { command: 'setPmOffset', pmOffset: 1e-12 },
    { command: 'setTempOffset', temperatureOffset: -10.01 },
    { command: 'setTempOffset', temperatureOffset: 10.01 },
    { command: 'setTempOffset', temperatureOffset: 0.001 },
    { command: 'setInterval', seconds: '300' },
    { command: 'setInterval', seconds: 300, extra: true },
    { command: 'setPmOffset', pmOffset: Infinity },
    { command: 'setPmOffset', pmOffset: NaN },
    { command: 'unknown' },
    { command: 'setInterval' },
  ])('rejects invalid command %j', (command) => {
    expect(ConfigurationCommandSchema.safeParse(command).success).toBe(false);
  });
  it('normalizes accepted negative offsets to integer wire units', () => {
    const cmd = ConfigurationCommandSchema.parse({
      command: 'setTempOffset',
      temperatureOffset: -1.23,
    });
    expect(configurationWireCommand(cmd)).toEqual({ command: 'setTempOffset', offsetX100: -123 });
    expect(configurationTarget(cmd)).toEqual({ opcode: 3, value: -123 });
  });
  const report = {
    deviceId: 'aaaaaaaa00000001',
    intervalS: 0,
    pmOffset: -3276.8,
    temperatureOffset: 327.67,
    lastCommand: 255,
    lastResult: 'malformed',
    reportedAt: new Date().toISOString(),
  };
  it('preserves wire-representable rejection reports outside outbound bounds', () => {
    expect(ReportedConfigurationSchema.parse(report)).toEqual(report);
  });
  it.each([
    { lastResult: 'invalid' },
    { reportedAt: 'yesterday' },
    { intervalS: 65536 },
    { lastCommand: 256 },
    { pmOffset: 0.01 },
  ])('rejects invalid report %j', (change) => {
    expect(ReportedConfigurationSchema.safeParse({ ...report, ...change }).success).toBe(false);
  });
  it('requires versioned jobs with normalized IDs and a future deadline', () => {
    const job = {
      version: 1,
      commandId: '27b5b8ba-d185-44fc-bc6b-45ae54c28373',
      deviceId: report.deviceId,
      command: { command: 'setInterval', seconds: 300 },
      queuedAt: '2026-10-23T10:00:00.000Z',
      expiresAt: '2026-10-23T11:00:00.000Z',
    };
    expect(ConfigurationJobSchema.safeParse(job).success).toBe(true);
    for (const invalid of [
      { version: 2 },
      { deviceId: 'AAAAAAAA00000001' },
      { expiresAt: job.queuedAt },
    ]) {
      expect(ConfigurationJobSchema.safeParse({ ...job, ...invalid }).success).toBe(false);
    }
  });

  it('compares job timestamps by instant, independently of fractional-second formatting', () => {
    const base = {
      version: 1,
      commandId: '27b5b8ba-d185-44fc-bc6b-45ae54c28373',
      deviceId: report.deviceId,
      command: { command: 'setInterval', seconds: 300 },
    };
    expect(
      ConfigurationJobSchema.safeParse({
        ...base,
        queuedAt: '2026-10-24T10:00:00Z',
        expiresAt: '2026-10-24T10:00:00.100Z',
      }).success,
    ).toBe(true);
    expect(
      ConfigurationJobSchema.safeParse({
        ...base,
        queuedAt: '2026-10-24T10:00:00.100Z',
        expiresAt: '2026-10-24T10:00:00Z',
      }).success,
    ).toBe(false);
    expect(
      ConfigurationJobSchema.safeParse({
        ...base,
        queuedAt: '2026-10-24T10:00:00Z',
        expiresAt: '2026-10-24T10:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it.each([
    [
      { command: 'setInterval', seconds: 21600 },
      { command: 'setInterval', seconds: 21600 },
    ],
    [
      { command: 'setPmOffset', pmOffset: -0.3 },
      { command: 'setPmOffset', offsetX10: -3 },
    ],
    [
      { command: 'setPmOffset', pmOffset: 50 },
      { command: 'setPmOffset', offsetX10: 500 },
    ],
    [
      { command: 'setTempOffset', temperatureOffset: -10 },
      { command: 'setTempOffset', offsetX100: -1000 },
    ],
    [
      { command: 'setTempOffset', temperatureOffset: 0.1 + 0.2 },
      { command: 'setTempOffset', offsetX100: 30 },
    ],
  ])('normalizes wire value for %j', (input, expected) => {
    expect(configurationWireCommand(ConfigurationCommandSchema.parse(input))).toEqual(expected);
  });
});

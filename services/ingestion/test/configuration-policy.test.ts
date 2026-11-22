import { configurationPolicy } from '@aq/db';
import { describe, expect, it } from 'vitest';

describe('configuration operator policy', () => {
  it('preserves documented defaults', () => {
    expect(configurationPolicy({})).toEqual({
      deadlineMs: 86400000,
      retentionSeconds: 604800,
      maxAttempts: 5,
      retryMs: 60000,
    });
  });
  it.each([
    ['CONFIG_COMMAND_TIMEOUT_MS', '1000', '604800000'],
    ['CONFIG_RESULT_RETENTION_SECONDS', '60', '31536000'],
    ['CONFIG_DISPATCH_MAX_ATTEMPTS', '1', '100'],
    ['CONFIG_DISPATCH_RETRY_MS', '60000', '3600000'],
  ])('validates boundaries and invalid settings for %s', (key, low, high) => {
    expect(() => configurationPolicy({ [key]: low })).not.toThrow();
    expect(() => configurationPolicy({ [key]: high })).not.toThrow();
    for (const value of [
      '',
      'NaN',
      'Infinity',
      '1.5',
      String(Number(low) - 1),
      String(Number(high) + 1),
    ]) {
      expect(() => configurationPolicy({ [key]: value })).toThrow(key);
    }
  });
});

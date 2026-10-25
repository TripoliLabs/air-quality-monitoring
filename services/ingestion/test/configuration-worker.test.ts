import type { ConfigurationStore } from '@aq/db';
import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { ConfigurationWorker } from '../src/ingestion/configuration-worker';

describe('configuration worker startup', () => {
  it('validates the fallback before allocating a Redis connection', () => {
    const reader = { on: vi.fn() };
    const redis = { duplicate: vi.fn(() => reader) };
    expect(
      () =>
        new ConfigurationWorker(
          redis as unknown as Redis,
          {} as ConfigurationStore,
          async () => {},
          'airquality',
        ),
    ).toThrow();
    expect(redis.duplicate).not.toHaveBeenCalled();
  });
});

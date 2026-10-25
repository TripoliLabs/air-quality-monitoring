import { randomBytes, randomUUID } from 'node:crypto';
import type { ConfigurationJob, ConfigurationTracking, ReportedConfiguration } from '@aq/contracts';
import {
  CONFIG_GROUP,
  CONFIG_STREAM,
  ConfigurationStore,
  configurationKeys,
  type ConfigurationPolicy,
} from '@aq/db';
import { Redis } from 'ioredis';
import { afterEach, vi } from 'vitest';
import {
  ConfigurationWorker,
  routingKey,
  type DownlinkPublisher,
} from '../../src/ingestion/configuration-worker';

export const applicationId = '00000000-0000-0000-0000-000000000001';
export const intervalCommand = { command: 'setInterval', seconds: 600 } as const;
export async function waitFor(
  check: () => Promise<boolean>,
  message = 'Configuration condition',
  timeout = 4000,
): Promise<void> {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`${message} timed out`);
}
export function dispatchJob(record: ConfigurationTracking): ConfigurationJob {
  return {
    version: 1,
    commandId: record.commandId,
    deviceId: record.deviceId,
    command: record.command,
    queuedAt: record.queuedAt,
    expiresAt: record.expiresAt,
  };
}
export function nodeReport(
  deviceId: string,
  change: Partial<ReportedConfiguration> = {},
): ReportedConfiguration {
  return {
    deviceId,
    intervalS: 600,
    pmOffset: 0,
    temperatureOffset: 0,
    lastCommand: 1,
    lastResult: 'applied',
    reportedAt: new Date().toISOString(),
    ...change,
  };
}
export function configurationHarness() {
  const fixtures: Array<{ redis: Redis; devices: string[]; workers: ConfigurationWorker[] }> = [];
  afterEach(async () => {
    vi.restoreAllMocks();
    const results = await Promise.allSettled(
      fixtures.splice(0).map(async ({ redis, devices, workers }) => {
        try {
          await Promise.all(workers.map((worker) => worker.stop()));
          await redis.del(
            CONFIG_STREAM,
            'config:deadlines',
            'config:dispatch:invalid',
            ...devices.flatMap((id) => [...configurationKeys(id).slice(0, 3), routingKey(id)]),
          );
        } finally {
          redis.disconnect();
        }
      }),
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length)
      throw new AggregateError(
        failures.map((result) => result.reason),
        'Test cleanup failed',
      );
  });
  return (overrides: Partial<ConfigurationPolicy> = {}) => {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      keyPrefix: `config-test:${randomUUID()}:`,
      commandTimeout: 2000,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => (attempt <= 1 ? 25 : null),
    });
    redis.on('error', () => {}); // Failed commands carry the error to the test.
    const devices: string[] = [];
    const workers: ConfigurationWorker[] = [];
    const newDevice = (): string => {
      const id = randomBytes(8).toString('hex');
      devices.push(id);
      return id;
    };
    const device = newDevice();
    fixtures.push({ redis, devices, workers });
    const store = new ConfigurationStore(redis, {
      deadlineMs: 60_000,
      retentionSeconds: 60,
      maxAttempts: 2,
      retryMs: 200,
      ...overrides,
    });
    const worker = (publish: DownlinkPublisher, fallback?: string): ConfigurationWorker => {
      const instance = new ConfigurationWorker(redis, store, publish, fallback);
      workers.push(instance);
      return instance;
    };
    const ageLease = async (): Promise<void> => {
      const key = configurationKeys(device)[0];
      const pending = JSON.parse((await redis.get(key))!);
      pending.leaseUntil = Date.now() - 1;
      await redis.set(key, JSON.stringify(pending));
      await redis.xclaim(
        CONFIG_STREAM,
        CONFIG_GROUP,
        'abandoned-test-consumer',
        0,
        pending.streamId,
        'IDLE',
        store.policy.retryMs + 1,
      );
    };
    return { redis, store, device, newDevice, worker, ageLease };
  };
}

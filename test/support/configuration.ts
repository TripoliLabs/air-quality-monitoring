/** Shared test support uses only built-ins; it does not depend on workspace runtime packages. */
export const testRedisOptions = {
  connectTimeout: 2000,
  commandTimeout: 2000,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt: number): number | null => (attempt <= 1 ? 25 : null),
};

export function boundedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(5000) });
}

interface CleanupRedis {
  get(key: string): Promise<string | null>;
  xack(key: string, group: string, id: string): Promise<number>;
  xdel(key: string, id: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  zrem(key: string, member: string): Promise<number>;
  disconnect(): void;
}

export async function cleanupConfigurationFixtures(
  redis: CleanupRedis,
  devices: string[],
  retire: (device: string) => Promise<unknown>,
): Promise<void> {
  try {
    const results = await Promise.allSettled(
      devices.map(async (device) => {
        try {
          await retire(device);
        } finally {
          try {
            const raw = await redis.get(`sensor:config:outstanding:${device}`);
            if (raw) {
              const pending = JSON.parse(raw) as { streamId: string };
              try {
                await redis.xack('config:dispatch:v1', 'config-dispatch', pending.streamId);
              } finally {
                await redis.xdel('config:dispatch:v1', pending.streamId);
              }
            }
          } finally {
            await Promise.all([
              redis.del(
                `sensor:config:outstanding:${device}`,
                `sensor:config:result:${device}`,
                `sensor:config:${device}`,
                `sensor:application:${device}`,
              ),
              redis.zrem('config:deadlines', device),
            ]);
          }
        }
      }),
    );
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length)
      throw new AggregateError(
        failed.map((result) => result.reason),
        'Configuration test cleanup failed',
      );
  } finally {
    redis.disconnect();
  }
}

import { type ConfigurationJob, type ReportedConfiguration } from '@aq/contracts';
import { CONFIG_GROUP, CONFIG_STREAM, ConfigurationStore, configurationKeys } from '@aq/db';
import { describe, expect, it, vi } from 'vitest';
import { configurationHarness } from './helpers/configuration';
import { routingKey } from '../src/ingestion/configuration-worker';

const app = '00000000-0000-0000-0000-000000000001';
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await sleep(50);
  }
  throw new Error('Configuration condition did not become true');
}

describe('recoverable configuration dispatch (real Redis, isolated key prefix)', () => {
  const fixture = configurationHarness();
  const command = { command: 'setInterval', seconds: 600 } as const;
  function job(
    record: NonNullable<Awaited<ReturnType<ConfigurationStore['enqueue']>>>,
  ): ConfigurationJob {
    const r = record.state.outstanding!;
    return {
      version: 1,
      commandId: r.commandId,
      deviceId: r.deviceId,
      command: r.command,
      queuedAt: r.queuedAt,
      expiresAt: r.expiresAt,
    };
  }

  it('atomically accepts exactly one concurrent enqueue, including its Stream entry', async () => {
    const { store, redis, device } = fixture();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => store.enqueue(device, command)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await redis.xlen(CONFIG_STREAM)).toBe(1);
    expect((await store.state(device)).outstanding?.commandId).toBe(
      results.find(Boolean)?.commandId,
    );
  });
  it('does not leave a pending record when enqueue encounters an invalid stream key', async () => {
    const { store, redis, device } = fixture();
    await redis.set(CONFIG_STREAM, 'wrong-type');
    await expect(store.enqueue(device, command)).rejects.toThrow('Invalid config key type');
    expect(await redis.get(configurationKeys(device)[0])).toBeNull();
  });
  it('recovers offline jobs once and distributes them among competing workers', async () => {
    const { store, redis, device, worker } = fixture({ retryMs: 5000 });
    await redis.set(routingKey(device), app);
    await store.enqueue(device, { command: 'setTempOffset', temperatureOffset: -1.23 });
    const published: Array<{ topic: string; payload: string }> = [];
    const publish = async (topic: string, payload: string): Promise<void> => {
      published.push({ topic, payload });
    };
    worker(publish).start();
    worker(publish).start();
    await until(async () => (await store.state(device)).outstanding?.status === 'dispatched');
    expect(published).toHaveLength(1);
    expect(published[0].topic).toBe(`application/${app}/device/${device}/command/down`);
    expect(JSON.parse(published[0].payload)).toEqual({
      devEui: device,
      confirmed: false,
      fPort: 10,
      data: Buffer.from([3, 133, 255]).toString('base64'),
    });
    expect(await redis.xlen(CONFIG_STREAM)).toBe(0);
  });
  it('reclaims an entry abandoned by a crashed consumer', async () => {
    const { store, redis, device, worker, ageLease } = fixture();
    await redis.set(routingKey(device), app);
    const accepted = (await store.enqueue(device, command))!;
    await redis.xgroup('CREATE', CONFIG_STREAM, CONFIG_GROUP, '0');
    await redis.xreadgroup(
      'GROUP',
      CONFIG_GROUP,
      'crashed',
      'COUNT',
      1,
      'STREAMS',
      CONFIG_STREAM,
      '>',
    );
    await store.begin(job(accepted), 'old-lease');
    await ageLease();
    let publishes = 0;
    worker(async () => {
      publishes++;
    }).start();
    await until(async () => (await store.state(device)).outstanding?.status === 'dispatched');
    expect(publishes).toBe(1);
    expect((await store.state(device)).outstanding?.attempts).toBe(2);
  });
  it('retains terminal MQTT errors after bounded retries', async () => {
    const { store, redis, device, worker } = fixture();
    await redis.set(routingKey(device), app);
    await store.enqueue(device, command);
    worker(async () => {
      throw new Error('broker unavailable');
    }).start();
    await until(async () => (await store.state(device)).latestResult?.status === 'failed');
    const state = await store.state(device);
    expect(state.outstanding).toBeNull();
    expect(state.latestResult?.attempts).toBe(2);
    expect(state.latestResult?.failure).toContain('broker unavailable');
    expect(await redis.ttl(configurationKeys(device)[1])).toBeGreaterThan(0);
  });
  it('reports missing routing as a failure without guessing an application', async () => {
    const { store, device, worker } = fixture({ maxAttempts: 1 });
    await store.enqueue(device, command);
    let publishes = 0;
    worker(async () => {
      publishes++;
    }).start();
    await until(async () => (await store.state(device)).latestResult?.status === 'failed');
    expect(publishes).toBe(0);
  });
  it('expires commands while workers are offline, retains the result, and allows a subsequent request', async () => {
    const { store, redis, device } = fixture({ retentionSeconds: 1 });
    const accepted = (await store.enqueue(device, command))!;
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(accepted.state.outstanding!.expiresAt));
    await store.expireDue();
    const state = await store.state(device);
    expect(state.outstanding).toBeNull();
    expect(state.latestResult?.status).toBe('timed_out');
    expect(await redis.xlen(CONFIG_STREAM)).toBe(0);
    expect(await store.enqueue(device, command)).not.toBeNull();
    await sleep(1100);
    expect(await redis.get(configurationKeys(device)[1])).toBeNull();
  });
  it('rejects old lease writes and never clears a newer request with an old report', async () => {
    const { store, device } = fixture();
    const first = (await store.enqueue(device, command))!;
    await store.begin(job(first), 'old');
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(first.state.outstanding!.expiresAt));
    const second = (await store.enqueue(device, command))!;
    await store.begin(job(second), 'new');
    await store.dispatched(job(first), 'old');
    expect((await store.state(device)).outstanding?.status).toBe('queued');
    await store.dispatched(job(second), 'new');
    await store.report(
      {
        deviceId: device,
        intervalS: 600,
        pmOffset: 0,
        temperatureOffset: 0,
        lastCommand: 1,
        lastResult: 'applied',
        reportedAt: first.state.outstanding!.queuedAt,
      },
      true,
    );
    expect((await store.state(device)).outstanding?.commandId).toBe(second.commandId);
  });
  it('leaves boot, stale, duplicate, mismatched and untrusted reports unresolved; matches integer values', async () => {
    const { store, redis, device } = fixture({ retryMs: 5000 });
    const accepted = (await store.enqueue(device, { command: 'setPmOffset', pmOffset: -1.2 }))!;
    await store.begin(job(accepted), 'lease');
    await store.dispatched(job(accepted), 'lease');
    const base: ReportedConfiguration = {
      deviceId: device,
      intervalS: 600,
      pmOffset: -1.2,
      temperatureOffset: 0,
      lastCommand: 2,
      lastResult: 'applied',
      reportedAt: '',
    };
    for (const change of [
      { lastResult: 'none', lastCommand: 0 },
      { lastCommand: 3 },
      { pmOffset: 0 },
    ]) {
      await sleep(5);
      await store.report(
        { ...base, ...change, reportedAt: new Date().toISOString() } as ReportedConfiguration,
        true,
      );
      expect((await store.state(device)).outstanding?.commandId).toBe(accepted.commandId);
    }
    await store.report({ ...base, reportedAt: accepted.state.outstanding!.queuedAt }, true);
    await store.report({ ...base, reportedAt: new Date().toISOString() }, false);
    expect((await store.state(device)).outstanding).not.toBeNull();
    await sleep(5);
    const applied = { ...base, reportedAt: new Date().toISOString() };
    await store.report(applied, true);
    expect((await store.state(device)).latestResult?.status).toBe('applied');
    expect((await store.state(device)).outstanding).toBeNull();
    await store.report(applied, true);
    expect((await store.state(device)).reported).toEqual(applied);
    expect(await redis.ttl(configurationKeys(device)[2])).toBe(-1);
  });
  it('retains matching device rejection independently of the requested value', async () => {
    const { store, device } = fixture({ retryMs: 5000 });
    const accepted = (await store.enqueue(device, command))!;
    await store.begin(job(accepted), 'lease');
    await store.dispatched(job(accepted), 'lease');
    await sleep(5);
    await store.report(
      {
        deviceId: device,
        intervalS: 300,
        pmOffset: 0,
        temperatureOffset: 0,
        lastCommand: 1,
        lastResult: 'out_of_range',
        reportedAt: new Date().toISOString(),
      },
      true,
    );
    expect((await store.state(device)).latestResult).toMatchObject({
      status: 'rejected',
      failure: 'out_of_range',
    });
  });
});

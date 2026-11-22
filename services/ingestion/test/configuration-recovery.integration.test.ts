import { CONFIG_GROUP, CONFIG_STREAM, configurationKeys } from '@aq/db';
import { describe, expect, it, vi } from 'vitest';
import { routingKey } from '../src/ingestion/configuration-worker';
import {
  applicationId,
  configurationHarness,
  dispatchJob,
  intervalCommand,
  nodeReport,
  waitFor,
} from './helpers/configuration';

describe('configuration recovery and concurrency regressions', () => {
  const fixture = configurationHarness();
  it('removes orphan deadlines so bounded sweeps can reach later expired commands', async () => {
    const { redis, store, device } = fixture();
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const deadline = Date.parse(accepted.state.outstanding!.expiresAt);
    for (let index = 0; index < 100; index++) {
      await redis.zadd('config:deadlines', deadline - 1, index.toString(16).padStart(16, '0'));
    }
    vi.spyOn(Date, 'now').mockReturnValue(deadline);
    await store.expireDue();
    await store.expireDue();
    expect(await redis.zcard('config:deadlines')).toBe(0);
    expect(await redis.get(configurationKeys(device)[0])).toBeNull();
    expect((await store.state(device)).latestResult?.status).toBe('timed_out');
  });
  it('continues dispatching healthy jobs when a different expired record is corrupt', async () => {
    const { redis, store, device, newDevice, worker } = fixture();
    const broken = newDevice();
    await redis.set(configurationKeys(broken)[0], '{');
    await redis.zadd('config:deadlines', Date.now() - 1, broken);
    await store.enqueue(device, intervalCommand);
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    await waitFor(async () => (await store.state(device)).outstanding?.status === 'dispatched');
    expect(publish).toHaveBeenCalledTimes(1);
    expect(await redis.get(configurationKeys(broken)[0])).toBe('{');
  });
  it('pages past corrupt deadlines and revisits them after repair', async () => {
    const { redis, store, device, newDevice } = fixture();
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const deadline = Date.parse(accepted.state.outstanding!.expiresAt);
    const broken = Array.from({ length: 100 }, () => newDevice());
    for (const id of broken) {
      await redis.set(configurationKeys(id)[0], '{');
      await redis.zadd('config:deadlines', deadline - 1, id);
    }
    vi.spyOn(Date, 'now').mockReturnValue(deadline);
    expect(await store.expireDue()).toHaveLength(100);
    expect(await store.expireDue()).toHaveLength(0);
    expect(await redis.get(configurationKeys(device)[0])).toBeNull();
    await redis.del(...broken.map((id) => configurationKeys(id)[0]));
    expect(await store.expireDue()).toHaveLength(0);
    expect(await redis.zcard('config:deadlines')).toBe(0);
  });
  it('retries a transient publication failure, clears its error, and awaits device confirmation', async () => {
    const { redis, store, device, worker, ageLease } = fixture({ retryMs: 60_000 });
    await redis.set(routingKey(device), applicationId);
    await store.enqueue(device, intervalCommand);
    const publish = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient MQTT error'))
      .mockResolvedValue(undefined);
    worker(publish).start();
    await waitFor(async () => Boolean((await store.state(device)).outstanding?.failure));
    await ageLease();
    await waitFor(async () => (await store.state(device)).outstanding?.status === 'dispatched');
    expect(publish).toHaveBeenCalledTimes(2);
    expect((await store.state(device)).outstanding).toMatchObject({
      attempts: 2,
      status: 'dispatched',
    });
    expect((await store.state(device)).outstanding?.failure).toBeUndefined();
    expect((await store.state(device)).latestResult).toBeNull();
  });
  it('recovers missing routing when a later uplink supplies the application', async () => {
    const { redis, store, device, worker, ageLease } = fixture({ retryMs: 60_000 });
    await store.enqueue(device, intervalCommand);
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish).start();
    await waitFor(async () => Boolean((await store.state(device)).outstanding?.failure));
    expect(publish).not.toHaveBeenCalled();
    await redis.set(routingKey(device), applicationId);
    await ageLease();
    await waitFor(async () => (await store.state(device)).outstanding?.status === 'dispatched');
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it('uses a validated configured fallback before the first uplink', async () => {
    const { store, device, worker } = fixture();
    await store.enqueue(device, intervalCommand);
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    await waitFor(async () => (await store.state(device)).outstanding?.status === 'dispatched');
    expect(publish.mock.calls[0][0]).toBe(
      `application/${applicationId}/device/${device}/command/down`,
    );
  });
  it.each(['{', JSON.stringify({ version: 2 }), JSON.stringify({ version: 1 })])(
    'quarantines malformed/version-mismatched jobs and keeps processing: %s',
    async (raw) => {
      const { redis, store, device, worker } = fixture();
      await redis.xadd(CONFIG_STREAM, '*', 'job', raw);
      await store.enqueue(device, intervalCommand);
      const publish = vi.fn().mockResolvedValue(undefined);
      worker(publish, applicationId).start();
      await waitFor(async () => (await store.state(device)).outstanding?.status === 'dispatched');
      expect(await redis.xlen('config:dispatch:invalid')).toBe(1);
      expect(await redis.xlen(CONFIG_STREAM)).toBe(0);
      expect(publish).toHaveBeenCalledTimes(1);
    },
  );
  it('acknowledges orphan jobs without publishing', async () => {
    const { redis, store, device, worker } = fixture();
    const accepted = (await store.enqueue(device, intervalCommand))!;
    await redis.del(configurationKeys(device)[0]);
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    await waitFor(async () => (await redis.xlen(CONFIG_STREAM)) === 0);
    expect(publish).not.toHaveBeenCalled();
    expect(accepted.commandId).toBeTruthy();
  });
  it('does not publish expired jobs when ingestion starts later', async () => {
    const { store, device, worker } = fixture();
    const accepted = (await store.enqueue(device, intervalCommand))!;
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(accepted.state.outstanding!.expiresAt));
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    await waitFor(async () => (await store.state(device)).latestResult?.status === 'timed_out');
    expect(publish).not.toHaveBeenCalled();
  });
  it('does not steal an active lease or accept stale progress after reclaim', async () => {
    const { redis, store, device, ageLease } = fixture({ retryMs: 60_000 });
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const job = dispatchJob(accepted.state.outstanding!);
    await redis.xgroup('CREATE', CONFIG_STREAM, CONFIG_GROUP, '0');
    await redis.xreadgroup('GROUP', CONFIG_GROUP, 'original', 'STREAMS', CONFIG_STREAM, '>');
    expect(await store.begin(job, 'first')).not.toBeNull();
    expect(await store.begin(job, 'competitor')).toBeNull();
    await ageLease();
    expect(await store.begin(job, 'second')).not.toBeNull();
    await store.dispatched(job, 'first');
    await store.retry(job, 'first', 'late failure');
    expect((await store.state(device)).outstanding).toMatchObject({
      status: 'queued',
      attempts: 2,
    });
    expect((await store.state(device)).outstanding?.failure).toBeUndefined();
    await store.dispatched(job, 'second');
    expect((await store.state(device)).outstanding?.status).toBe('dispatched');
  });
  it('documents duplicate publication after progress recording fails, without false device success', async () => {
    const { store, device, worker, ageLease } = fixture({ retryMs: 60_000 });
    await store.enqueue(device, intervalCommand);
    const record = vi
      .spyOn(store, 'dispatched')
      .mockRejectedValueOnce(new Error('Redis progress write lost'));
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    await waitFor(async () => Boolean((await store.state(device)).outstanding?.failure));
    expect(record).toHaveBeenCalledTimes(1);
    await ageLease();
    await waitFor(async () => (await store.state(device)).outstanding?.status === 'dispatched');
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls[0]).toEqual(publish.mock.calls[1]);
    expect((await store.state(device)).latestResult).toBeNull();
  });
  it('stops promptly during a blocking read without consuming subsequent work', async () => {
    const { redis, store, device, worker } = fixture();
    const publish = vi.fn().mockResolvedValue(undefined);
    const instance = worker(publish, applicationId);
    instance.start();
    await waitFor(async () => (await redis.exists(CONFIG_STREAM)) === 1);
    await instance.stop();
    await store.enqueue(device, intervalCommand);
    expect(await redis.xlen(CONFIG_STREAM)).toBe(1);
    expect(publish).not.toHaveBeenCalled();
  });
  it('waits for an active dispatch during shutdown and leaves a recoverable truthful result', async () => {
    const { store, device, worker } = fixture({ retryMs: 60_000 });
    await store.enqueue(device, intervalCommand);
    let release!: () => void;
    const publication = new Promise<void>((resolve) => {
      release = resolve;
    });
    const publish = vi.fn(() => publication);
    const instance = worker(publish, applicationId);
    instance.start();
    try {
      await waitFor(async () => publish.mock.calls.length === 1);
      let stopped = false;
      const stop = instance.stop().then(() => {
        stopped = true;
      });
      await Promise.resolve();
      expect(stopped).toBe(false);
      release();
      await stop;
      expect((await store.state(device)).outstanding?.status).toBe('dispatched');
      expect((await store.state(device)).latestResult).toBeNull();
    } finally {
      // An assertion/setup failure must not strand afterEach in worker.stop().
      release();
      await instance.stop();
    }
  });
  it('retains a failure until a later command actually reaches a terminal outcome', async () => {
    const { store, device } = fixture({ maxAttempts: 1 });
    const first = (await store.enqueue(device, intervalCommand))!;
    const firstJob = dispatchJob(first.state.outstanding!);
    await store.begin(firstJob, 'first');
    await store.retry(firstJob, 'first', 'broker failed');
    const second = (await store.enqueue(device, intervalCommand))!;
    expect(second.state.latestResult).toMatchObject({
      commandId: first.commandId,
      status: 'failed',
    });
    expect(second.state.outstanding?.commandId).toBe(second.commandId);
  });

  it('fails an abandoned job at the retry limit without an additional publication', async () => {
    const { redis, store, device, worker, ageLease } = fixture({ maxAttempts: 1, retryMs: 60_000 });
    const accepted = (await store.enqueue(device, intervalCommand))!;
    await redis.xgroup('CREATE', CONFIG_STREAM, CONFIG_GROUP, '0');
    await redis.xreadgroup('GROUP', CONFIG_GROUP, 'crashed', 'STREAMS', CONFIG_STREAM, '>');
    await store.begin(dispatchJob(accepted.state.outstanding!), 'crashed');
    await ageLease();
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    await waitFor(async () => (await store.state(device)).latestResult?.status === 'failed');
    expect(publish).not.toHaveBeenCalled();
    expect((await store.state(device)).latestResult?.failure).toContain(
      'may have occurred before a crash',
    );
  });

  it('rechecks expiration after routing lookup before publication', async () => {
    const { redis, store, device, worker } = fixture();
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const get = redis.get.bind(redis);
    vi.spyOn(redis, 'get').mockImplementation(async (key) => {
      if (key === routingKey(device)) {
        vi.spyOn(Date, 'now').mockReturnValue(Date.parse(accepted.state.outstanding!.expiresAt));
        return applicationId;
      }
      return get(key);
    });
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish).start();
    await waitFor(async () => (await store.state(device)).latestResult?.status === 'timed_out');
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects corrupt cached routing instead of silently using the fallback', async () => {
    const { redis, store, device, worker } = fixture({ maxAttempts: 1 });
    await redis.set(routingKey(device), 'airquality');
    await store.enqueue(device, intervalCommand);
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    await waitFor(async () => (await store.state(device)).latestResult?.status === 'failed');
    expect(publish).not.toHaveBeenCalled();
  });
  it('dispatches a batch exactly once in ordinary processing with competing consumers', async () => {
    const { store, newDevice, worker } = fixture({ retryMs: 60_000 });
    const devices = Array.from({ length: 8 }, () => newDevice());
    await Promise.all(devices.map((id) => store.enqueue(id, intervalCommand)));
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    worker(publish, applicationId).start();
    await waitFor(async () =>
      (await Promise.all(devices.map((id) => store.state(id)))).every(
        (state) => state.outstanding?.status === 'dispatched',
      ),
    );
    expect(publish).toHaveBeenCalledTimes(devices.length);
    const published = publish.mock.calls.map(([, payload]) => JSON.parse(payload).devEui);
    expect(new Set(published)).toEqual(new Set(devices));
  });
  it('encodes the owned command record even if a valid Stream job carries another setting', async () => {
    const { redis, store, device, worker } = fixture();
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const key = configurationKeys(device)[0];
    const pending = JSON.parse((await redis.get(key))!);
    await redis.xdel(CONFIG_STREAM, pending.streamId);
    pending.streamId = await redis.xadd(
      CONFIG_STREAM,
      '*',
      'job',
      JSON.stringify({
        ...dispatchJob(accepted.state.outstanding!),
        command: { command: 'setInterval', seconds: 900 },
      }),
    );
    await redis.set(key, JSON.stringify(pending));
    const publish = vi.fn().mockResolvedValue(undefined);
    worker(publish, applicationId).start();
    await waitFor(async () => (await store.state(device)).outstanding?.status === 'dispatched');
    expect(JSON.parse(publish.mock.calls[0][1]).data).toBe(
      Buffer.from([1, 88, 2]).toString('base64'),
    );
  });
});

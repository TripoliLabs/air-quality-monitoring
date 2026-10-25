import { describe, expect, it, vi } from 'vitest';
import { boundedFetch, cleanupConfigurationFixtures } from '../../../test/support/configuration';

describe('configuration test cleanup', () => {
  function redis() {
    return {
      get: vi.fn().mockResolvedValue(null),
      xack: vi.fn().mockResolvedValue(1),
      xdel: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
      zrem: vi.fn().mockResolvedValue(1),
      disconnect: vi.fn(),
    };
  }
  it('cleans every owned device and disconnects even when retiring fails', async () => {
    const client = redis();
    await expect(
      cleanupConfigurationFixtures(client, ['a', 'b'], async () => {
        throw new Error('API down');
      }),
    ).rejects.toThrow('cleanup failed');
    expect(client.del).toHaveBeenCalledTimes(2);
    expect(client.zrem).toHaveBeenCalledTimes(2);
    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(client.del.mock.calls.flat()).not.toContain('config:dispatch:v1');
  });
  it('always disconnects and attempts key cleanup if Redis reads fail', async () => {
    const client = redis();
    client.get.mockRejectedValue(new Error('Redis down'));
    await expect(cleanupConfigurationFixtures(client, ['a'], async () => {})).rejects.toThrow(
      'cleanup failed',
    );
    expect(client.del).toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledOnce();
  });
  it('removes only the owned pending Stream entry', async () => {
    const client = redis();
    client.get.mockResolvedValue(JSON.stringify({ streamId: '123-0' }));
    await cleanupConfigurationFixtures(client, ['a'], async () => {});
    expect(client.xack).toHaveBeenCalledWith('config:dispatch:v1', 'config-dispatch', '123-0');
    expect(client.xdel).toHaveBeenCalledWith('config:dispatch:v1', '123-0');
  });
  it('still deletes an owned job when acknowledging it fails', async () => {
    const client = redis();
    client.get.mockResolvedValue(JSON.stringify({ streamId: '123-0' }));
    client.xack.mockRejectedValue(new Error('Consumer group unavailable'));
    await expect(cleanupConfigurationFixtures(client, ['a'], async () => {})).rejects.toThrow(
      'cleanup failed',
    );
    expect(client.xdel).toHaveBeenCalledWith('config:dispatch:v1', '123-0');
    expect(client.del).toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledOnce();
  });
  it('adds a timeout to HTTP calls without replacing caller-provided cancellation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    try {
      await boundedFetch('http://localhost/test');
      expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
      const signal = new AbortController().signal;
      await boundedFetch('http://localhost/test', { signal });
      expect(fetchMock.mock.calls[1][1]?.signal).toBe(signal);
    } finally {
      fetchMock.mockRestore();
    }
  });
});

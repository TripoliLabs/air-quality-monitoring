import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IngestionService } from '../src/ingestion/ingestion.service';

type Publisher = {
  client?: { connected: boolean; publish: ReturnType<typeof vi.fn> };
  publishDownlink: (topic: string, payload: string) => Promise<void>;
};
function publisher(connected = true): Publisher {
  const instance = Object.create(IngestionService.prototype) as Publisher;
  instance.client = { connected, publish: vi.fn() };
  return instance;
}
describe('MQTT publication lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('rejects a disconnected broker before publication', async () => {
    const instance = publisher(false);
    await expect(instance.publishDownlink('topic', 'payload')).rejects.toThrow('disconnected');
    expect(instance.client!.publish).not.toHaveBeenCalled();
  });
  it('uses QoS 1 and retain false and awaits broker acknowledgement', async () => {
    const instance = publisher();
    let acknowledged = false;
    const pending = instance.publishDownlink('topic', 'payload').then(() => {
      acknowledged = true;
    });
    expect(instance.client!.publish).toHaveBeenCalledWith(
      'topic',
      'payload',
      { qos: 1, retain: false },
      expect.any(Function),
    );
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    instance.client!.publish.mock.calls[0][3](null);
    await pending;
    expect(acknowledged).toBe(true);
  });
  it('rejects broker callback errors and clears the deadline', async () => {
    vi.useFakeTimers();
    const instance = publisher();
    const pending = instance.publishDownlink('topic', 'payload');
    const failure = expect(pending).rejects.toThrow('broker rejected');
    instance.client!.publish.mock.calls[0][3](new Error('broker rejected'));
    await failure;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('clears its timer when mqtt.publish throws synchronously', async () => {
    vi.useFakeTimers();
    const instance = publisher();
    instance.client!.publish.mockImplementation(() => {
      throw new Error('client closed');
    });
    await expect(instance.publishDownlink('topic', 'payload')).rejects.toThrow('client closed');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('times out without claiming cancellation; a late callback cannot turn failure into success', async () => {
    vi.useFakeTimers();
    const instance = publisher();
    const pending = instance.publishDownlink('topic', 'payload');
    const failure = expect(pending).rejects.toThrow('delivery is uncertain');
    await vi.advanceTimersByTimeAsync(10_000);
    await failure;
    instance.client!.publish.mock.calls[0][3](null);
    expect(vi.getTimerCount()).toBe(0);
    await expect(pending).rejects.toThrow('timed out');
  });
});

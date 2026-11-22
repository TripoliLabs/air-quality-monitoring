import { describe, expect, it, vi } from 'vitest';
import {
  configurationHarness,
  dispatchJob,
  intervalCommand,
  nodeReport,
} from './helpers/configuration';

describe('configuration report ordering and reconciliation', () => {
  const fixture = configurationHarness();
  it.each([
    [
      { command: 'setInterval', seconds: 600 },
      { intervalS: 600, lastCommand: 1 },
    ],
    [
      { command: 'setPmOffset', pmOffset: -1.2 },
      { pmOffset: -1.2, lastCommand: 2 },
    ],
    [
      { command: 'setTempOffset', temperatureOffset: -1.23 },
      { temperatureOffset: -1.23, lastCommand: 3 },
    ],
  ] as const)('matches requested integer wire units for %j', async (command, reported) => {
    const { store, device } = fixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const accepted = (await store.enqueue(device, command))!;
    const job = dispatchJob(accepted.state.outstanding!);
    await store.begin(job, 'lease');
    await store.dispatched(job, 'lease');
    clock.mockReturnValue(now + 100);
    await store.report(
      nodeReport(device, { ...reported, reportedAt: new Date(now + 100).toISOString() }),
      true,
    );
    expect((await store.state(device)).latestResult).toMatchObject({
      commandId: job.commandId,
      status: 'applied',
    });
    expect((await store.state(device)).outstanding).toBeNull();
  });
  it.each(['out_of_range', 'malformed'] as const)(
    'retains matching %s device rejection',
    async (lastResult) => {
      const { store, device } = fixture();
      const now = Date.now();
      const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
      const accepted = (await store.enqueue(device, intervalCommand))!;
      const job = dispatchJob(accepted.state.outstanding!);
      await store.begin(job, 'lease');
      await store.dispatched(job, 'lease');
      clock.mockReturnValue(now + 100);
      await store.report(
        nodeReport(device, {
          lastResult,
          intervalS: 300,
          reportedAt: new Date(now + 100).toISOString(),
        }),
        true,
      );
      expect((await store.state(device)).latestResult).toMatchObject({
        status: 'rejected',
        failure: lastResult,
      });
    },
  );
  it('orders equivalent ISO formats by instant before storing canonical report timestamps', async () => {
    const { store, device } = fixture();
    await store.report(
      nodeReport(device, { reportedAt: '2026-01-01T10:00:00Z', intervalS: 300 }),
      true,
    );
    await store.report(
      nodeReport(device, { reportedAt: '2026-01-01T10:00:00.100Z', intervalS: 600 }),
      true,
    );
    expect((await store.state(device)).reported).toMatchObject({
      intervalS: 600,
      reportedAt: '2026-01-01T10:00:00.100Z',
    });
    await store.report(
      nodeReport(device, { reportedAt: '2026-01-01T10:00:00.1Z', intervalS: 900 }),
      true,
    );
    expect((await store.state(device)).reported?.intervalS).toBe(600);
  });
  it.each([
    { lastCommand: 0, lastResult: 'none' },
    { lastCommand: 2 },
    { intervalS: 300 },
  ] as const)('leaves unrelated reports outstanding: %j', async (change) => {
    const { store, device } = fixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const job = dispatchJob(accepted.state.outstanding!);
    await store.begin(job, 'lease');
    await store.dispatched(job, 'lease');
    clock.mockReturnValue(now + 100);
    await store.report(
      nodeReport(device, { ...change, reportedAt: new Date(now + 100).toISOString() }),
      true,
    );
    expect((await store.state(device)).outstanding?.commandId).toBe(job.commandId);
    expect((await store.state(device)).latestResult).toBeNull();
  });
  it('does not confirm reports at/before publication, in the future, or without trusted source time', async () => {
    const { store, device } = fixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const job = dispatchJob(accepted.state.outstanding!);
    await store.begin(job, 'lease');
    await store.dispatched(job, 'lease');
    for (const [offset, trusted] of [
      [-1, true],
      [0, true],
      [1000, false],
    ] as const) {
      await store.report(
        nodeReport(device, { reportedAt: new Date(now + offset).toISOString() }),
        trusted,
      );
      expect((await store.state(device)).outstanding?.commandId).toBe(job.commandId);
    }
    clock.mockReturnValue(now + 100);
    await store.report(nodeReport(device, { reportedAt: new Date(now + 200).toISOString() }), true);
    expect((await store.state(device)).outstanding?.commandId).toBe(job.commandId);
  });
  it('conservatively leaves a report received before dispatch recording unresolved', async () => {
    const { store, device } = fixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const job = dispatchJob(accepted.state.outstanding!);
    await store.begin(job, 'lease');
    clock.mockReturnValue(now + 100);
    const report = nodeReport(device, { reportedAt: new Date(now + 100).toISOString() });
    await store.report(report, true);
    await store.dispatched(job, 'lease');
    await store.report(report, true); // Replay is not new evidence.
    expect((await store.state(device)).outstanding?.status).toBe('dispatched');
    clock.mockReturnValue(now + 200);
    await store.report(nodeReport(device, { reportedAt: new Date(now + 200).toISOString() }), true);
    expect((await store.state(device)).latestResult?.status).toBe('applied');
  });
  it('keeps timeout terminal while allowing a late report to update reported state', async () => {
    const { store, device } = fixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const accepted = (await store.enqueue(device, intervalCommand))!;
    const job = dispatchJob(accepted.state.outstanding!);
    await store.begin(job, 'lease');
    await store.dispatched(job, 'lease');
    clock.mockReturnValue(Date.parse(job.expiresAt) + 1);
    await store.report(
      nodeReport(device, { reportedAt: new Date(Date.now()).toISOString() }),
      true,
    );
    expect(await store.state(device)).toMatchObject({
      reported: { intervalS: 600 },
      outstanding: null,
      latestResult: { commandId: job.commandId, status: 'timed_out' },
    });
  });
  it('atomically handles expiration/report/enqueue races without clearing a newer queued request', async () => {
    const { store, device } = fixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const first = (await store.enqueue(device, intervalCommand))!;
    const job = dispatchJob(first.state.outstanding!);
    await store.begin(job, 'first');
    await store.dispatched(job, 'first');
    clock.mockReturnValue(Date.parse(job.expiresAt) + 1);
    const [, second] = await Promise.all([
      store.report(nodeReport(device, { reportedAt: new Date(now + 100).toISOString() }), true),
      store.enqueue(device, { command: 'setInterval', seconds: 900 }),
    ]);
    expect(second).not.toBeNull();
    expect((await store.state(device)).outstanding).toMatchObject({
      commandId: second!.commandId,
      status: 'queued',
    });
    expect((await store.state(device)).latestResult?.commandId).toBe(first.commandId);
  });
});

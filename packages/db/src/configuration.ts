import { randomUUID } from 'node:crypto';
import {
  type ConfigurationCommand,
  type ConfigurationJob,
  type ConfigurationState,
  ConfigurationStateSchema,
  type ConfigurationTracking,
  ConfigurationTrackingSchema,
  configurationTarget,
  type ReportedConfiguration,
  ReportedConfigurationSchema,
} from '@aq/contracts';
import type { Redis } from 'ioredis';

export const CONFIG_STREAM = 'config:dispatch:v1';
export const CONFIG_GROUP = 'config-dispatch';
export const CONFIG_DEADLINES = 'config:deadlines';
export const configurationKeys = (id: string): string[] => [
  `sensor:config:outstanding:${id}`,
  `sensor:config:result:${id}`,
  `sensor:config:${id}`,
  CONFIG_STREAM,
  CONFIG_DEADLINES,
];

// Every mutation checks ownership inside Redis, including lease ownership. All
// keys live on the same standalone Redis instance (not Redis Cluster).
const TRANSITION = `
local op, now, iso, retention, device = ARGV[1], tonumber(ARGV[2]), ARGV[3], ARGV[4], ARGV[5]
local types = {'string', 'string', 'string', 'stream', 'zset'}
for i, key in ipairs(KEYS) do
  local kind = redis.call('TYPE', key).ok
  if kind ~= 'none' and kind ~= types[i] then return redis.error_reply('Invalid config key type') end
end
local raw = redis.call('GET', KEYS[1])
local pending = raw and cjson.decode(raw) or nil
-- Repair an orphan index entry atomically, without racing a new enqueue.
if not pending then redis.call('ZREM', KEYS[5], device) end
local function ack(id)
  redis.pcall('XACK', KEYS[4], '${CONFIG_GROUP}', id)
  redis.call('XDEL', KEYS[4], id)
end
local function finish(status, reason)
  pending.record.status = status
  pending.record.completedAt = iso
  pending.record.failure = reason
  redis.call('SET', KEYS[2], cjson.encode(pending.record), 'EX', retention)
  redis.call('DEL', KEYS[1])
  redis.call('ZREM', KEYS[5], device)
  ack(pending.streamId)
  pending = nil
end
if pending and pending.expiresMs <= now then
  finish('timed_out', 'Server deadline elapsed; a queued device downlink may still apply')
end
if op == 'enqueue' then
  if pending then return false end
  local record = cjson.decode(ARGV[6])
  local streamId = redis.call('XADD', KEYS[4], '*', 'job', ARGV[7])
  pending = {record=record, expiresMs=tonumber(ARGV[8]), streamId=streamId, leaseUntil=0}
  redis.call('SET', KEYS[1], cjson.encode(pending))
  redis.call('ZADD', KEYS[5], pending.expiresMs, device)
elseif op == 'begin' then
  if not pending or pending.record.commandId ~= ARGV[6] then return false end
  if pending.record.status ~= 'queued' or pending.leaseUntil > now then return false end
  if pending.record.attempts >= tonumber(ARGV[9]) then
    finish('failed', 'Dispatch retry limit reached; publication may have occurred before a crash')
    return false
  end
  pending.record.attempts = pending.record.attempts + 1
  pending.record.lastAttemptAt = iso
  pending.token = ARGV[7]
  pending.leaseUntil = now + tonumber(ARGV[8])
  redis.call('SET', KEYS[1], cjson.encode(pending))
  return cjson.encode(pending.record)
elseif op == 'dispatched' or op == 'retry' then
  if not pending or pending.record.commandId ~= ARGV[6] or pending.token ~= ARGV[7]
    or pending.leaseUntil <= now then return false end
  if op == 'retry' then
    pending.record.failure = ARGV[8]
    if pending.record.attempts >= tonumber(ARGV[9]) then
      finish('failed', ARGV[8])
    else
      redis.call('SET', KEYS[1], cjson.encode(pending))
    end
  else
    pending.record.status = 'dispatched'
    pending.record.dispatchedAt = iso
    pending.record.failure = nil
    redis.call('SET', KEYS[1], cjson.encode(pending))
    ack(pending.streamId)
  end
elseif op == 'report' then
  local report = cjson.decode(ARGV[6])
  local old = redis.call('GET', KEYS[3])
  -- Missing source timestamps cannot establish ordering against existing state.
  if old and (ARGV[7] ~= 'trusted' or cjson.decode(old).reportedAt >= report.reportedAt) then
    return false
  end
  redis.call('SET', KEYS[3], ARGV[6])
  if pending and pending.record.status == 'dispatched' and ARGV[7] == 'trusted'
    and report.reportedAt > pending.record.lastAttemptAt
    and report.reportedAt <= iso and report.lastCommand == pending.record.opcode then
    local value = report.intervalS
    if report.lastCommand == 2 then value = math.floor(report.pmOffset * 10 + 0.5) end
    if report.lastCommand == 3 then value = math.floor(report.temperatureOffset * 100 + 0.5) end
    if report.lastResult == 'applied' and value == pending.record.wireValue then
      finish('applied', nil)
    elseif report.lastResult == 'out_of_range' or report.lastResult == 'malformed' then
      finish('rejected', report.lastResult)
    end
  end
end
local reported = redis.call('GET', KEYS[3])
local result = redis.call('GET', KEYS[2])
return cjson.encode({reported=reported and cjson.decode(reported) or cjson.null,
  outstanding=pending and pending.record or cjson.null,
  latestResult=result and cjson.decode(result) or cjson.null})
`;

export interface ConfigurationPolicy {
  deadlineMs: number;
  retentionSeconds: number;
  maxAttempts: number;
  retryMs: number;
}

/** Reject invalid operator settings rather than silently disabling bounds. */
export function configurationPolicy(env: Record<string, string | undefined>): ConfigurationPolicy {
  const positive = (key: string, fallback: number, min: number, max: number): number => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${key} must be an integer between ${min} and ${max}`);
    }
    return value;
  };
  return {
    deadlineMs: positive('CONFIG_COMMAND_TIMEOUT_MS', 86_400_000, 1000, 604_800_000),
    retentionSeconds: positive('CONFIG_RESULT_RETENTION_SECONDS', 604_800, 60, 31_536_000),
    maxAttempts: positive('CONFIG_DISPATCH_MAX_ATTEMPTS', 5, 1, 100),
    retryMs: positive('CONFIG_DISPATCH_RETRY_MS', 60_000, 60_000, 3_600_000),
  };
}

export class ConfigurationStore {
  private expiryOffset = 0;

  constructor(
    private readonly redis: Redis,
    readonly policy: ConfigurationPolicy,
  ) {}

  private async transition(
    deviceId: string,
    op: string,
    args: Array<string | number> = [],
  ): Promise<unknown> {
    const now = Date.now();
    return this.redis.eval(
      TRANSITION,
      5,
      ...configurationKeys(deviceId),
      op,
      now,
      new Date(now).toISOString(),
      this.policy.retentionSeconds,
      deviceId,
      ...args,
    );
  }

  async state(deviceId: string): Promise<ConfigurationState> {
    return ConfigurationStateSchema.parse(
      JSON.parse(String(await this.transition(deviceId, 'get'))),
    );
  }

  async enqueue(
    deviceId: string,
    command: ConfigurationCommand,
  ): Promise<{
    commandId: string;
    state: ConfigurationState;
  } | null> {
    const now = Date.now();
    const target = configurationTarget(command);
    const record: ConfigurationTracking = ConfigurationTrackingSchema.parse({
      commandId: randomUUID(),
      deviceId,
      command,
      opcode: target.opcode,
      wireValue: target.value,
      queuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.policy.deadlineMs).toISOString(),
      status: 'queued',
      attempts: 0,
    });
    const job: ConfigurationJob = {
      version: 1,
      commandId: record.commandId,
      deviceId,
      command,
      queuedAt: record.queuedAt,
      expiresAt: record.expiresAt,
    };
    const result = await this.transition(deviceId, 'enqueue', [
      JSON.stringify(record),
      JSON.stringify(job),
      now + this.policy.deadlineMs,
    ]);
    if (!result) return null;
    return {
      commandId: record.commandId,
      state: ConfigurationStateSchema.parse(JSON.parse(String(result))),
    };
  }

  async begin(job: ConfigurationJob, token: string): Promise<ConfigurationTracking | null> {
    const result = await this.transition(job.deviceId, 'begin', [
      job.commandId,
      token,
      this.policy.retryMs,
      this.policy.maxAttempts,
    ]);
    return result ? ConfigurationTrackingSchema.parse(JSON.parse(String(result))) : null;
  }

  async dispatched(job: ConfigurationJob, token: string): Promise<void> {
    await this.transition(job.deviceId, 'dispatched', [job.commandId, token]);
  }

  async retry(job: ConfigurationJob, token: string, failure: string): Promise<void> {
    await this.transition(job.deviceId, 'retry', [
      job.commandId,
      token,
      failure.slice(0, 500),
      this.policy.maxAttempts,
    ]);
  }

  async report(report: ReportedConfiguration, trustedTime: boolean): Promise<void> {
    const validated = ReportedConfigurationSchema.parse(report);
    const normalized = { ...validated, reportedAt: new Date(validated.reportedAt).toISOString() };
    await this.transition(report.deviceId, 'report', [
      JSON.stringify(normalized),
      trustedTime ? 'trusted' : 'unknown',
    ]);
  }

  async expireDue(): Promise<Array<{ deviceId: string; error: string }>> {
    const devices = await this.redis.zrangebyscore(
      CONFIG_DEADLINES,
      '-inf',
      Date.now(),
      'LIMIT',
      this.expiryOffset,
      100,
    );
    const failures: Array<{ deviceId: string; error: string }> = [];
    for (const deviceId of devices) {
      try {
        await this.state(deviceId);
      } catch (error) {
        failures.push({ deviceId, error: String(error) });
      }
    }
    // Successful transitions remove their index entries. Skip retained failures
    // on the next page, then wrap so repaired records are eventually revisited.
    this.expiryOffset = devices.length < 100 ? 0 : this.expiryOffset + failures.length;
    return failures;
  }
}

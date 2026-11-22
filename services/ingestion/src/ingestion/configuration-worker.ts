import { randomUUID } from 'node:crypto';
import {
  ApplicationIdSchema,
  ConfigurationJobSchema,
  configurationWireCommand,
} from '@aq/contracts';
import { CONFIG_GROUP, CONFIG_STREAM, ConfigurationStore } from '@aq/db';
import { createLogger } from '@aq/observability';
import { DOWNLINK_FPORT, encodeDownlink } from '@aq/telemetry-codec';
import type { Redis } from 'ioredis';

type Entry = [string, string[]];
export const routingKey = (deviceId: string): string => `sensor:application:${deviceId}`;
export type DownlinkPublisher = (topic: string, payload: string) => Promise<void>;

/** One consumer group shared by replicas; a separate connection blocks on reads. */
export class ConfigurationWorker {
  private readonly log = createLogger('config-dispatch');
  private readonly consumer = randomUUID();
  private readonly reader: Redis;
  private running = false;
  private task?: Promise<void>;
  private claimCursor = '0-0';
  private readonly fallback?: string;

  constructor(
    private readonly redis: Redis,
    private readonly store: ConfigurationStore,
    private readonly publish: DownlinkPublisher,
    applicationId?: string,
  ) {
    this.fallback = applicationId ? ApplicationIdSchema.parse(applicationId) : undefined;
    this.reader = redis.duplicate({ commandTimeout: 5000 });
    this.reader.on('error', (error) =>
      this.log.error('stream connection error', { error: String(error) }),
    );
  }

  start(): void {
    this.running = true;
    this.task = this.run();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.reader.disconnect();
    await this.task;
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        try {
          await this.redis.xgroup('CREATE', CONFIG_STREAM, CONFIG_GROUP, '0', 'MKSTREAM');
        } catch (error) {
          if (!String(error).includes('BUSYGROUP')) throw error;
        }
        for (const failure of await this.store.expireDue()) {
          this.log.error('configuration expiration failed; record retained for repair', failure);
        }
        const claimed = (await this.reader.xautoclaim(
          CONFIG_STREAM,
          CONFIG_GROUP,
          this.consumer,
          this.store.policy.retryMs,
          this.claimCursor,
          'COUNT',
          1,
        )) as [string, Entry[]];
        this.claimCursor = claimed[0];
        for (const entry of claimed[1]) {
          if (this.running) await this.process(entry);
        }
        if (!this.running) break;
        const result = (await this.reader.xreadgroup(
          'GROUP',
          CONFIG_GROUP,
          this.consumer,
          'COUNT',
          1,
          'BLOCK',
          1000,
          'STREAMS',
          CONFIG_STREAM,
          '>',
        )) as [string, Entry[]][] | null;
        for (const [, entries] of result ?? []) {
          for (const entry of entries) if (this.running) await this.process(entry);
        }
      } catch (error) {
        if (this.running) {
          this.log.error('dispatch loop error; will recover pending entries', {
            error: String(error),
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }

  private async acknowledge(id: string): Promise<void> {
    await this.redis.multi().xack(CONFIG_STREAM, CONFIG_GROUP, id).xdel(CONFIG_STREAM, id).exec();
  }

  private async process([id, fields]: Entry): Promise<void> {
    let parsed: unknown;
    try {
      const index = fields.indexOf('job');
      parsed = JSON.parse(index >= 0 ? fields[index + 1] : 'null');
    } catch {
      parsed = null;
    }
    const validated = ConfigurationJobSchema.safeParse(parsed);
    if (!validated.success) {
      this.log.error('invalid dispatch job', { streamId: id, error: validated.error.message });
      await this.redis.xadd(
        'config:dispatch:invalid',
        'MAXLEN',
        '~',
        100,
        '*',
        'streamId',
        id,
        'error',
        validated.error.message.slice(0, 500),
      );
      await this.acknowledge(id);
      return;
    }
    const job = validated.data;
    const token = randomUUID();
    const record = await this.store.begin(job, token);
    if (!record) {
      const state = await this.store.state(job.deviceId);
      if (state.outstanding?.commandId !== job.commandId || state.outstanding.status !== 'queued') {
        await this.acknowledge(id);
      }
      return;
    }
    try {
      const route = (await this.redis.get(routingKey(job.deviceId))) ?? this.fallback;
      if (!route)
        throw new Error('No ChirpStack application ID; wait for an uplink or configure a fallback');
      const applicationId = ApplicationIdSchema.parse(route);
      if (Date.now() >= Date.parse(record.expiresAt)) {
        await this.store.state(job.deviceId);
        return;
      }
      // Use the owned record's validated command, never mutable Stream data.
      const data = Buffer.from(encodeDownlink(configurationWireCommand(record.command))).toString(
        'base64',
      );
      await this.publish(
        `application/${applicationId}/device/${job.deviceId}/command/down`,
        JSON.stringify({ devEui: job.deviceId, confirmed: false, fPort: DOWNLINK_FPORT, data }),
      );
      await this.store.dispatched(job, token);
    } catch (error) {
      const message = `Dispatch failed (routing or MQTT): ${String(error)}`;
      this.log.warn(message, { commandId: job.commandId });
      await this.store.retry(job, token, message);
      // Remains in the PEL until the retry lease expires, unless terminal.
    }
  }
}

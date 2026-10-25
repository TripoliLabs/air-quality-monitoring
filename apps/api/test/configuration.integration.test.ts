import { randomBytes, randomUUID } from 'node:crypto';
import {
  ConfigurationAcceptedSchema,
  ConfigurationStateSchema,
  ConfigurationTrackingSchema,
} from '@aq/contracts';
import {
  boundedFetch as fetch,
  cleanupConfigurationFixtures,
  testRedisOptions,
} from '../../../test/support/configuration';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const API = process.env.API_URL ?? 'http://localhost:3000';
const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': process.env.ADMIN_API_KEY ?? 'ci-test-admin-key',
};
const command = { command: 'setInterval', seconds: 600 };
const device = randomBytes(8).toString('hex');
const retired = randomBytes(8).toString('hex');
const active = randomBytes(8).toString('hex');
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', testRedisOptions);
redis.on('error', () => {});
const post = (id: string, body: unknown, auth = headers): Promise<Response> =>
  fetch(`${API}/sensors/${id}/config`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(body),
  });

describe('configuration HTTP API', () => {
  beforeAll(async () => {
    for (const [id, status] of [
      [device, 'maintenance'],
      [retired, 'retired'],
      [active, 'active'],
    ]) {
      const response = await fetch(`${API}/sensors`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deviceId: id,
          name: 'Configuration integration',
          latitude: 34.45,
          longitude: 35.82,
          status,
          isSimulated: true,
        }),
      });
      expect(response.status).toBe(201);
    }
  });
  afterAll(async () => {
    await cleanupConfigurationFixtures(redis, [device, retired, active], (id) =>
      fetch(`${API}/sensors/${id}`, { method: 'DELETE', headers }),
    );
  });
  it('publicly returns nullable state for a registered device', async () => {
    const res = await fetch(`${API}/sensors/${device}/config`);
    expect(res.status).toBe(200);
    expect(ConfigurationStateSchema.parse(await res.json())).toEqual({
      reported: null,
      outstanding: null,
      latestResult: null,
    });
  });
  it('requires the existing admin API key', async () => {
    expect(
      (await post(device, command, { 'Content-Type': 'application/json', 'X-API-Key': '' })).status,
    ).toBe(401);
    expect((await post(device, command, { ...headers, 'X-API-Key': 'invalid' })).status).toBe(401);
  });
  it('returns 404 for an unknown device on reads and writes', async () => {
    const unknown = randomBytes(8).toString('hex');
    expect((await fetch(`${API}/sensors/${unknown}/config`)).status).toBe(404);
    expect((await post(unknown, command)).status).toBe(404);
  });
  it('rejects retired devices with 409', async () => {
    expect((await post(retired, command)).status).toBe(409);
  });
  it.each([
    null,
    [],
    'setInterval',
    { command: 'setInterval', seconds: '600' },
    { command: 'setPmOffset', pmOffset: -50.1 },
    { command: 'setTempOffset', temperatureOffset: 10.01 },
    { command: 'setInterval', seconds: 30 },
    { command: 'setPmOffset', pmOffset: 1.23 },
    { command: 'setTempOffset', temperatureOffset: -0.001 },
    { ...command, extra: true },
  ])('returns 400 for invalid command %j', async (body) => {
    expect((await post(device, body)).status).toBe(400);
  });
  it('allows maintenance devices, normalizes IDs, and atomically rejects concurrent POSTs', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => post(device.toUpperCase(), command)),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([202, 409, 409, 409, 409]);
    const accepted = ConfigurationAcceptedSchema.parse(
      await responses.find((r) => r.status === 202)!.json(),
    );
    expect(accepted.outstanding).toMatchObject({
      deviceId: device,
      commandId: accepted.commandId,
      command,
    });
    const current = ConfigurationStateSchema.parse(
      await (await fetch(`${API}/sensors/${device}/config`)).json(),
    );
    expect(current.outstanding?.commandId).toBe(accepted.commandId);
  });
  it('allows active sensors to request a negative calibration offset', async () => {
    const res = await post(active, { command: 'setPmOffset', pmOffset: -1.2 });
    expect(res.status).toBe(202);
    expect(ConfigurationAcceptedSchema.parse(await res.json()).outstanding).toMatchObject({
      deviceId: active,
      status: 'queued',
      opcode: 2,
      wireValue: -12,
    });
  });
  it('publicly exposes retained failures rather than presenting an empty configuration state', async () => {
    const now = Date.now();
    const result = ConfigurationTrackingSchema.parse({
      commandId: randomUUID(),
      deviceId: retired,
      command,
      opcode: 1,
      wireValue: 600,
      queuedAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 60000).toISOString(),
      completedAt: new Date(now).toISOString(),
      status: 'failed',
      attempts: 1,
      failure: 'MQTT publication could not be confirmed',
    });
    await redis.set(`sensor:config:result:${retired}`, JSON.stringify(result), 'EX', 60);
    const response = await fetch(`${API}/sensors/${retired}/config`);
    expect(response.status).toBe(200);
    expect(ConfigurationStateSchema.parse(await response.json())).toEqual({
      reported: null,
      outstanding: null,
      latestResult: result,
    });
  });
  it('documents the public read, secured 202 response, command alternatives and errors', async () => {
    const document = await (await fetch(`${API}/docs-json`)).json();
    const route = document.paths['/sensors/{deviceId}/config'];
    expect(route.get.responses['200']).toBeTruthy();
    expect(route.get.security ?? []).toEqual([]);
    expect(route.post.security).toContainEqual({ 'admin-api-key': [] });
    for (const status of ['202', '400', '401', '404', '409', '503'])
      expect(route.post.responses[status]).toBeTruthy();
    const body = route.post.requestBody.content['application/json'].schema;
    const schema = body.$ref ? document.components.schemas[body.$ref.split('/').pop()] : body;
    expect(schema.oneOf ?? schema.anyOf).toHaveLength(3);
  });
});

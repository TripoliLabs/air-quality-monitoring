import { randomBytes } from 'node:crypto';
import { ConfigurationStateSchema } from '@aq/contracts';
import {
  boundedFetch as fetch,
  cleanupConfigurationFixtures,
  testRedisOptions,
} from '../../../test/support/configuration';
import { ConfigResult, encodeConfigReport, encodeUplink } from '@aq/telemetry-codec';
import { Redis } from 'ioredis';
import { connectAsync } from 'mqtt';
import { expect, it } from 'vitest';

it('routes a heartbeat before the first report, publishes correct MQTT bytes, and reconciles a fresh report', async () => {
  const API = process.env.API_URL ?? 'http://localhost:3000';
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.ADMIN_API_KEY ?? 'ci-test-admin-key',
  };
  const device = randomBytes(8).toString('hex');
  const app = '00000000-0000-0000-0000-000000000001';
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', testRedisOptions);
  redis.on('error', () => {});
  let client: Awaited<ReturnType<typeof connectAsync>> | undefined;
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const eventTime = async (): Promise<string> => {
    const [s, us] = await redis.time();
    return new Date(Number(s) * 1000 + Math.floor(Number(us) / 1000)).toISOString();
  };
  const state = async () =>
    ConfigurationStateSchema.parse(await (await fetch(`${API}/sensors/${device}/config`)).json());
  const until = async (check: () => Promise<boolean>): Promise<void> => {
    for (let i = 0; i < 60; i++) {
      if (await check()) return;
      await sleep(100);
    }
    throw new Error('MQTT configuration condition timed out');
  };
  try {
    client = await connectAsync(process.env.MQTT_URL ?? 'mqtt://localhost:1883', {
      connectTimeout: 2000,
      reconnectPeriod: 0,
    });
    expect(
      (
        await fetch(`${API}/sensors`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            deviceId: device,
            name: 'MQTT configuration test',
            latitude: 34.45,
            longitude: 35.82,
            isSimulated: true,
          }),
        })
      ).status,
    ).toBe(201);
    const down = `application/${app}/device/${device}/command/down`;
    const up = `application/${app}/device/${device}/event/up`;
    await client.subscribeAsync(down, { qos: 1 });
    const publications: Array<{ payload: unknown; retain: boolean; qos: number }> = [];
    client.on('message', (topic, bytes, packet) => {
      if (topic === down)
        publications.push({
          payload: JSON.parse(bytes.toString()),
          retain: packet.retain,
          qos: packet.qos,
        });
    });
    const heartbeat = encodeUplink({
      pm25: 0,
      pm10: 0,
      temperature: 0,
      humidity: 0,
      pressure: 0,
      batteryMv: 3800,
    });
    heartbeat[12] &= 0x0f;
    await client.publishAsync(
      up,
      JSON.stringify({
        deviceInfo: { devEui: device.toUpperCase(), applicationId: app },
        fPort: 2,
        data: Buffer.from(heartbeat).toString('base64'),
        time: await eventTime(),
      }),
      { qos: 1 },
    );
    await until(async () => (await redis.get(`sensor:application:${device}`)) === app);
    expect((await state()).reported).toBeNull();
    const response = await fetch(`${API}/sensors/${device}/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ command: 'setTempOffset', temperatureOffset: -1.23 }),
    });
    expect(response.status).toBe(202);
    await until(async () => (await state()).outstanding?.status === 'dispatched');
    await until(async () => publications.length > 0);
    expect(publications).toEqual([
      {
        payload: {
          devEui: device,
          confirmed: false,
          fPort: 10,
          data: Buffer.from([3, 133, 255]).toString('base64'),
        },
        retain: false,
        qos: 1,
      },
    ]);
    // A fresh subscriber receives nothing: the command was not retained at the broker.
    await client.unsubscribeAsync(down);
    await client.subscribeAsync(down, { qos: 1 });
    await sleep(100);
    expect(publications).toHaveLength(1);
    await client.publishAsync(
      up,
      JSON.stringify({
        deviceInfo: { devEui: device, applicationId: app },
        fPort: 11,
        time: await eventTime(),
        data: Buffer.from(
          encodeConfigReport({
            lastResult: ConfigResult.None,
            lastCommand: 0,
            intervalS: 300,
            pmOffsetX10: 0,
            tempOffsetX100: -123,
          }),
        ).toString('base64'),
      }),
      { qos: 1 },
    );
    await until(async () => (await state()).reported?.lastResult === 'none');
    expect((await state()).outstanding?.status).toBe('dispatched');
    await sleep(5);
    await client.publishAsync(
      up,
      JSON.stringify({
        deviceInfo: { devEui: device, applicationId: app },
        fPort: 11,
        time: await eventTime(),
        data: Buffer.from(
          encodeConfigReport({
            lastResult: ConfigResult.Applied,
            lastCommand: 3,
            intervalS: 300,
            pmOffsetX10: 0,
            tempOffsetX100: -123,
          }),
        ).toString('base64'),
      }),
      { qos: 1 },
    );
    await until(async () => (await state()).latestResult?.status === 'applied');
    expect((await state()).outstanding).toBeNull();
    expect((await state()).reported?.temperatureOffset).toBe(-1.23);
  } finally {
    try {
      await client?.endAsync(true);
    } finally {
      await cleanupConfigurationFixtures(redis, [device], (id) =>
        fetch(`${API}/sensors/${id}`, { method: 'DELETE', headers }),
      );
    }
  }
}, 20_000);

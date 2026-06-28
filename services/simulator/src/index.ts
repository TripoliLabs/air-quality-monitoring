/**
 * Simulated LoRaWAN deployment.
 *
 * For each fixture node it RUNS THE NODE FIRMWARE (the host build of the real
 * ESP32 application code, `firmware/build/aq-node-sim`) to sample its simulated
 * PMS7003 + BME280 and produce the base64 uplink payload — i.e. the data
 * genuinely originates from the firmware, byte-for-byte what the device emits.
 *
 * It then wraps that payload in a ChirpStack v4 application-uplink envelope
 * (multiple gateways in rxInfo to mimic aggregation) and publishes it to MQTT.
 * This injects at ChirpStack's application-integration boundary — exactly what a
 * provisioned ChirpStack emits after gateway + network-server processing, which
 * is what the ingestion service consumes. (The LoRa RF hop is the hardware
 * boundary; true RF-layer simulation would use chirpstack-simulator.)
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SENSOR_FIXTURES } from '@aq/db';
import { connect } from 'mqtt';

const execFileAsync = promisify(execFile);

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS ?? 15000);
const APP_ID = process.env.SIM_APP_ID ?? '00000000-0000-0000-0000-000000000001';
const FIRMWARE_BIN = process.env.FIRMWARE_BIN ?? '../../firmware/build/aq-node-sim';

const GATEWAYS = ['ac1f09fffe000101', 'ac1f09fffe000102'];

const fcnt = new Map<string, number>(SENSOR_FIXTURES.map((f) => [f.deviceId, 0]));

const log = (o: Record<string, unknown>): void =>
  console.log(JSON.stringify({ service: 'simulator', ...o }));

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

/** Run the node firmware to produce this node's uplink payload (base64). */
async function sampleFirmware(baselinePm25: number, hour: number, fc: number): Promise<string> {
  const { stdout } = await execFileAsync(
    FIRMWARE_BIN,
    [
      '--baseline-pm25',
      String(baselinePm25),
      '--hour',
      hour.toFixed(2),
      '--fcnt',
      String(fc),
      '--seed',
      String(fc * 7 + Math.floor(baselinePm25)),
    ],
    { timeout: 5000 },
  );
  return stdout.trim();
}

const client = connect(MQTT_URL);

client.on('connect', () => {
  log({
    level: 'info',
    msg: 'connected',
    url: MQTT_URL,
    nodes: SENSOR_FIXTURES.length,
    firmware: FIRMWARE_BIN,
    intervalMs: INTERVAL_MS,
  });
  void tick();
  setInterval(() => void tick(), INTERVAL_MS);
});

client.on('error', (err) => log({ level: 'error', msg: 'mqtt error', error: String(err) }));

async function tick(): Promise<void> {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  let published = 0;

  await Promise.all(
    SENSOR_FIXTURES.map(async (node) => {
      const fc = (fcnt.get(node.deviceId) ?? 0) + 1;
      fcnt.set(node.deviceId, fc);
      try {
        const data = await sampleFirmware(node.baselinePm25, hour, fc);

        // Multiple gateways heard this uplink (aggregation) — strongest first.
        const rxInfo = GATEWAYS.filter(() => Math.random() > 0.25).map((gatewayId) => ({
          gatewayId,
          rssi: Math.round(rand(-110, -55)),
          snr: Number(rand(-6, 9).toFixed(1)),
        }));
        if (rxInfo.length === 0) rxInfo.push({ gatewayId: GATEWAYS[0], rssi: -95, snr: 2 });
        rxInfo.sort((a, b) => b.rssi - a.rssi);

        const uplink = {
          deviceInfo: { devEui: node.deviceId, deviceName: node.name, applicationId: APP_ID },
          fPort: 2,
          fCnt: fc,
          data,
          time: new Date().toISOString(),
          rxInfo,
        };
        client.publish(
          `application/${APP_ID}/device/${node.deviceId}/event/up`,
          JSON.stringify(uplink),
          { qos: 0 },
        );
        published += 1;
      } catch (err) {
        log({
          level: 'error',
          msg: 'firmware sample failed',
          deviceId: node.deviceId,
          error: String(err),
        });
      }
    }),
  );

  log({ level: 'info', msg: 'tick: published uplinks', published });
}

const shutdown = (): void => {
  client.end(true, undefined, () => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

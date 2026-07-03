/**
 * Simulated LoRaWAN deployment — the truest local path, with a real OTAA join.
 *
 *   firmware (real C app code, host build)  →  payload bytes
 *      → device MAC: OTAA Join Request → Join Accept → derive session keys
 *                    then Unconfirmed Data Up (encrypt + MIC)        (lora-packet)
 *      → gateway: Semtech UDP packet forwarder (uplink + downlink)   (gateway.ts)
 *      → chirpstack-gateway-bridge  →  ChirpStack (join server, decrypt, dedupe)
 *      → MQTT application uplink  →  ingestion → TimescaleDB + Redis → API → dashboard
 *
 * On startup it provisions ChirpStack (application, OTAA device-profile, gateway,
 * devices + root AppKeys), persists the root credentials to a Docker volume
 * (never the repo), then performs an OTAA join per device before streaming data.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { SENSOR_FIXTURES } from '@aq/db';
import { DOWNLINK_FPORT, decodeDownlink, encodeDownlink } from '@aq/telemetry-codec';
import { enqueueDownlink, provision } from './chirpstack';
import { SemtechGateway } from './gateway';
import {
  buildJoinRequest,
  buildUplink,
  type DeviceCredentials,
  type DeviceSession,
  decryptDownlink,
  deriveSession,
  downlinkDevAddr,
  downlinkFPort,
  newDevNonce,
} from './lorawan';

const execFileAsync = promisify(execFile);

const GRPC_ADDR = process.env.CHIRPSTACK_GRPC ?? 'chirpstack:8080';
const REST_BASE = process.env.CHIRPSTACK_REST ?? 'http://chirpstack-rest-api:8090';
const USER = process.env.CHIRPSTACK_USER ?? 'admin';
const PASS = process.env.CHIRPSTACK_PASS ?? 'admin';
const GATEWAY_EUI = process.env.GATEWAY_EUI ?? 'ac1f09fffe000101';
const BRIDGE_HOST = process.env.GATEWAY_BRIDGE_HOST ?? 'chirpstack-gateway-bridge';
const BRIDGE_PORT = Number(process.env.GATEWAY_BRIDGE_PORT ?? 1700);
const KEYS_DIR = process.env.KEYS_DIR ?? '/keys';
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS ?? 15000);
const FIRMWARE_BIN = process.env.FIRMWARE_BIN ?? '../../firmware/build/aq-node-sim';

const log = (o: Record<string, unknown>): void =>
  console.log(JSON.stringify({ service: 'simulator', ...o }));
const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type CredStore = Record<string, Omit<DeviceCredentials, 'devEui'>>;

function loadCreds(): CredStore {
  try {
    return JSON.parse(fs.readFileSync(path.join(KEYS_DIR, 'devices.json'), 'utf8')) as CredStore;
  } catch {
    return {};
  }
}

function saveCreds(devices: DeviceCredentials[]): void {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  const store: CredStore = Object.fromEntries(
    devices.map((d) => [d.devEui, { joinEui: d.joinEui, appKey: d.appKey }]),
  );
  fs.writeFileSync(path.join(KEYS_DIR, 'devices.json'), JSON.stringify(store, null, 2));
}

async function sampleFirmware(baselinePm25: number, hour: number, fCnt: number): Promise<Buffer> {
  const { stdout } = await execFileAsync(
    FIRMWARE_BIN,
    [
      '--baseline-pm25',
      String(baselinePm25),
      '--hour',
      hour.toFixed(2),
      '--fcnt',
      String(fCnt),
      '--seed',
      String(fCnt * 7 + Math.floor(baselinePm25)),
    ],
    { timeout: 5000 },
  );
  return Buffer.from(stdout.trim(), 'base64');
}

async function provisionWithRetry(existing: CredStore): Promise<DeviceCredentials[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await provision({
        grpcAddr: GRPC_ADDR,
        restBase: REST_BASE,
        user: USER,
        pass: PASS,
        gatewayEui: GATEWAY_EUI,
        fixtures: SENSOR_FIXTURES.map((f) => ({ deviceId: f.deviceId, name: f.name })),
        existingCreds: existing,
      });
      log({ level: 'info', msg: 'provisioned ChirpStack (OTAA)', devices: result.devices.length });
      return result.devices;
    } catch (err) {
      if (attempt >= 30) throw err;
      log({ level: 'warn', msg: 'provision retry', attempt, error: String(err) });
      await sleep(3000);
    }
  }
}

/** Perform an OTAA join: Join Request → wait for Join Accept → derive session keys. */
async function joinDevice(
  gateway: SemtechGateway,
  cred: DeviceCredentials,
): Promise<DeviceSession> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const devNonce = newDevNonce();
    gateway.uplink(buildJoinRequest(cred, devNonce), rand(-95, -60), rand(2, 9));
    try {
      const joinAccept = await gateway.waitForDownlink(8000);
      return deriveSession(cred, devNonce, joinAccept);
    } catch {
      log({ level: 'warn', msg: 'OTAA join retry', devEui: cred.devEui, attempt });
    }
  }
  throw new Error(`OTAA join failed for ${cred.devEui}`);
}

async function main(): Promise<void> {
  const creds = await provisionWithRetry(loadCreds());
  saveCreds(creds);

  const gateway = new SemtechGateway(BRIDGE_HOST, BRIDGE_PORT, GATEWAY_EUI);
  gateway.start();
  await sleep(1000); // let the PULL_DATA route establish

  // Join every device (sequential — one Join Accept downlink at a time).
  const sessions: DeviceSession[] = [];
  for (const cred of creds) {
    const session = await joinDevice(gateway, cred);
    log({
      level: 'info',
      msg: 'device joined (OTAA)',
      devEui: session.devEui,
      devAddr: session.devAddr,
    });
    sessions.push(session);
  }

  const baseline = new Map(SENSOR_FIXTURES.map((f) => [f.deviceId, f.baselinePm25]));
  const fCnt = new Map(sessions.map((s) => [s.devEui, 0]));

  // Receive config downlinks the device would apply on-node (decrypt → decode).
  gateway.onDataDownlink((phy) => {
    const session = sessions.find((s) => s.devAddr === downlinkDevAddr(phy));
    if (!session) return;
    // Only our application config downlinks; ignore MAC-only downlinks (ADR, etc.).
    if (downlinkFPort(phy) !== DOWNLINK_FPORT) return;
    try {
      const cmd = decodeDownlink(new Uint8Array(decryptDownlink(session, phy)));
      log({
        level: 'info',
        msg: 'config downlink received + applied',
        devEui: session.devEui,
        cmd,
      });
    } catch (err) {
      log({ level: 'warn', msg: 'config downlink decode failed', error: String(err) });
    }
  });

  async function tick(): Promise<void> {
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    let sent = 0;
    await Promise.all(
      sessions.map(async (session) => {
        const fc = (fCnt.get(session.devEui) ?? 0) + 1;
        fCnt.set(session.devEui, fc);
        try {
          const payload = await sampleFirmware(baseline.get(session.devEui) ?? 30, hour, fc);
          gateway.uplink(buildUplink(session, fc, payload), rand(-110, -55), rand(-6, 9));
          sent += 1;
        } catch (err) {
          log({ level: 'error', msg: 'uplink failed', devEui: session.devEui, error: String(err) });
        }
      }),
    );
    log({ level: 'info', msg: 'tick: data uplinks sent', sent });
  }

  await tick();

  // One-time demo of the downlink config channel: retune the first device's
  // sample interval. ChirpStack delivers it in the RX window after that device's
  // next uplink; the onDataDownlink handler above decodes + logs it applied.
  try {
    const cmd = { command: 'setInterval', seconds: 600 } as const;
    await enqueueDownlink(
      { grpcAddr: GRPC_ADDR, restBase: REST_BASE, user: USER, pass: PASS },
      sessions[0].devEui,
      DOWNLINK_FPORT,
      encodeDownlink(cmd),
    );
    log({ level: 'info', msg: 'enqueued config downlink', devEui: sessions[0].devEui, cmd });
  } catch (err) {
    log({ level: 'warn', msg: 'enqueue downlink failed', error: String(err) });
  }

  setInterval(() => void tick(), INTERVAL_MS);

  const shutdown = (): void => {
    gateway.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log({ level: 'error', msg: 'fatal', error: String(err) });
  process.exit(1);
});

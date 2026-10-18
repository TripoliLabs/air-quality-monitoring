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
 *
 * Each node runs on its own schedule, set by the firmware: after every wake it
 * says how long it would deep-sleep, scaled here so the default 300 s interval
 * takes SIM_INTERVAL_MS. Config downlinks are handed to the firmware, which
 * applies or rejects them and confirms with a config report on fPort 11, exactly
 * as a real node does. A simulator restart is a power cycle: each node cold-boots
 * but keeps the settings it stored, as a real node keeps them in flash. Recreate
 * the container (or set a fresh SIM_STATE_DIR) for nodes straight from the factory.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { SENSOR_FIXTURES } from '@aq/db';
import {
  CONFIG_REPORT_FPORT,
  ConfigResult,
  DOWNLINK_FPORT,
  decodeConfigReport,
  decodeDownlink,
  encodeDownlink,
} from '@aq/telemetry-codec';
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
// Per-node firmware state (the host stand-in for RTC RAM + NVS).
const STATE_DIR = process.env.SIM_STATE_DIR ?? path.join(os.tmpdir(), 'aq-node-state');
const DEFAULT_INTERVAL_S = 300; // the firmware default that SIM_INTERVAL_MS stands for

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

/** What one wake of the node firmware sends, and how long it then sleeps. */
interface Wake {
  fPort: number;
  payload: Buffer;
  sleepS: number;
}

async function runFirmware(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(FIRMWARE_BIN, args, { timeout: 5000 });
  return stdout.trim();
}

/** Run one wake of the node firmware: a reading on fPort 2, or a config report. */
async function wakeFirmware(
  stateFile: string,
  boot: boolean,
  baselinePm25: number,
  hour: number,
  fCnt: number,
): Promise<Wake> {
  const out = await runFirmware([
    '--state',
    stateFile,
    ...(boot ? ['--boot'] : []),
    '--baseline-pm25',
    String(baselinePm25),
    '--hour',
    hour.toFixed(2),
    '--fcnt',
    String(fCnt),
    '--seed',
    String(fCnt * 7 + Math.floor(baselinePm25)),
  ]);
  const [fPort, b64, sleepS] = out.split(' ');
  return { fPort: Number(fPort), payload: Buffer.from(b64, 'base64'), sleepS: Number(sleepS) };
}

/** Hand a received downlink to the node firmware; it applies or rejects it. */
async function deliverDownlink(
  stateFile: string,
  fPort: number,
  data: Buffer,
): Promise<{ result: number; intervalS: number; sleepS: number }> {
  const out = await runFirmware([
    '--state',
    stateFile,
    '--downlink',
    data.toString('hex'),
    '--fport',
    String(fPort),
  ]);
  const [result, intervalS, , , sleepS] = out.split(' ').map(Number);
  return { result, intervalS, sleepS };
}

/** A firmware sleep, in simulated time. */
const sleepMs = (sleepS: number): number =>
  Math.max(1000, Math.round((INTERVAL_MS * sleepS) / DEFAULT_INTERVAL_S));

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
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const queues = new Map<string, Promise<void>>();

  // Starting the simulator powers every node on: the first wake is a boot.
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const booted = new Set<string>();
  const stateFile = (devEui: string): string => path.join(STATE_DIR, `${devEui}.state`);

  // A node does one thing at a time: a downlink is applied after the wake that
  // received it, never in the middle of one.
  function serial(devEui: string, fn: () => Promise<void>): Promise<void> {
    const next = (queues.get(devEui) ?? Promise.resolve()).then(fn);
    queues.set(
      devEui,
      next.catch(() => undefined),
    );
    return next;
  }

  function schedule(session: DeviceSession, sleepS: number): void {
    clearTimeout(timers.get(session.devEui));
    timers.set(
      session.devEui,
      setTimeout(() => void wake(session), sleepMs(sleepS)),
    );
  }

  let readingsSent = 0;
  let reportsSent = 0;

  function wake(session: DeviceSession): Promise<void> {
    return serial(session.devEui, async () => {
      const hour = new Date().getHours() + new Date().getMinutes() / 60;
      const fc = (fCnt.get(session.devEui) ?? 0) + 1;
      fCnt.set(session.devEui, fc);
      let sleepS = DEFAULT_INTERVAL_S;
      try {
        const boot = !booted.has(session.devEui);
        booted.add(session.devEui);
        const out = await wakeFirmware(
          stateFile(session.devEui),
          boot,
          baseline.get(session.devEui) ?? 30,
          hour,
          fc,
        );
        sleepS = out.sleepS;
        gateway.uplink(
          buildUplink(session, fc, out.payload, out.fPort),
          rand(-110, -55),
          rand(-6, 9),
        );
        if (out.fPort === CONFIG_REPORT_FPORT) {
          reportsSent += 1;
          log({
            level: 'info',
            msg: 'config report sent',
            devEui: session.devEui,
            report: decodeConfigReport(new Uint8Array(out.payload)),
          });
        } else {
          readingsSent += 1;
        }
      } catch (err) {
        log({ level: 'error', msg: 'uplink failed', devEui: session.devEui, error: String(err) });
      }
      schedule(session, sleepS);
    });
  }

  // Config downlinks arrive in the receive window after an uplink; the firmware
  // applies or rejects them and its next wake reports the result.
  gateway.onDataDownlink((phy) => {
    const session = sessions.find((s) => s.devAddr === downlinkDevAddr(phy));
    if (!session) return;
    // Only our application config downlinks; ignore MAC-only downlinks (ADR, etc.).
    const fPort = downlinkFPort(phy);
    if (fPort !== DOWNLINK_FPORT) return;
    const data = decryptDownlink(session, phy);
    void serial(session.devEui, async () => {
      let cmd: unknown = data.toString('hex');
      try {
        cmd = decodeDownlink(new Uint8Array(data));
      } catch {
        // Not a command we know; the firmware rejects it and reports that.
      }
      const applied = await deliverDownlink(stateFile(session.devEui), fPort, data);
      log({
        level: 'info',
        msg:
          applied.result === ConfigResult.Applied
            ? 'config downlink applied'
            : 'config downlink rejected',
        devEui: session.devEui,
        cmd,
        result: applied.result,
        intervalS: applied.intervalS,
      });
      schedule(session, applied.sleepS);
    }).catch((err) => {
      log({ level: 'warn', msg: 'config downlink failed', error: String(err) });
    });
  });

  await Promise.all(sessions.map((session) => wake(session)));

  // One-time demo of the downlink config channel: retune the first device's
  // sample interval. ChirpStack delivers it in the RX window after that device's
  // next uplink; the firmware applies it and confirms with a config report.
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

  setInterval(() => {
    log({ level: 'info', msg: 'uplinks sent', readings: readingsSent, reports: reportsSent });
    readingsSent = 0;
    reportsSent = 0;
  }, INTERVAL_MS);

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

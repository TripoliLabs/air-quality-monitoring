/**
 * LoRa uplink payload codec.
 *
 * THE SINGLE SOURCE OF TRUTH for the byte layout shared between the ESP32
 * firmware (C struct) and the ingestion service (TS decoder). Any change here
 * must be mirrored in firmware/; the shared test vectors in ./vectors, which both
 * test suites read, fail CI if the two disagree. Layout (little-endian, 13 bytes):
 *
 *   offset  size  field          encoding
 *   0       2     pm25 (x10)      uint16   µg/m³ × 10
 *   2       2     pm10 (x10)      uint16   µg/m³ × 10
 *   4       2     temperature     int16    °C × 100
 *   6       2     humidity (x100) uint16   % × 100
 *   8       2     pressure        uint16   hPa (offset by 0)
 *   10      2     batteryMv       uint16   millivolts
 *   12      1     version + presence   uint8
 *
 * Byte 12: low nibble = payload version, high nibble = sensor-presence bitmask.
 * The decoder branches on version (graceful mixed-firmware rollouts); legacy
 * firmware that sent 0 decodes as version 0 (== all sensors present).
 */
export const PAYLOAD_LENGTH = 13;
export const PAYLOAD_VERSION = 1;

/** Sensor-presence bits (high nibble of byte 12). */
export const PRESENT_PM = 0x10; // pm25 + pm10
export const PRESENT_ENV = 0x20; // temperature + humidity + pressure

export interface SensorsPresent {
  pm: boolean;
  env: boolean;
}

export interface DecodedPayload {
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  pressure: number;
  batteryMv: number;
  /** Payload version from byte 12 (present on decode). */
  version?: number;
  /** Which sensor groups the node reported as populated (present on decode; on
   * encode, defaults to every sensor). */
  sensorsPresent?: SensorsPresent;
}

export function decodeUplink(bytes: Uint8Array): DecodedPayload {
  if (bytes.length < PAYLOAD_LENGTH) {
    throw new Error(`Payload too short: expected ${PAYLOAD_LENGTH}, got ${bytes.length}`);
  }

  const flags = bytes[12];
  const version = flags & 0x0f;
  if (version > PAYLOAD_VERSION) {
    throw new Error(
      `Unsupported payload version ${version} (decoder supports up to ${PAYLOAD_VERSION})`,
    );
  }
  // Version 0 predates the presence bitmask → treat all sensors as present.
  const sensorsPresent: SensorsPresent =
    version === 0
      ? { pm: true, env: true }
      : { pm: (flags & PRESENT_PM) !== 0, env: (flags & PRESENT_ENV) !== 0 };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    pm25: view.getUint16(0, true) / 10,
    pm10: view.getUint16(2, true) / 10,
    temperature: view.getInt16(4, true) / 100,
    humidity: view.getUint16(6, true) / 100,
    pressure: view.getUint16(8, true),
    batteryMv: view.getUint16(10, true),
    version,
    sensorsPresent,
  };
}

// Clamp to the wire range so a negative (e.g. a calibration offset) or huge value
// saturates instead of wrapping modulo 2^16.
const u16 = (v: number): number => Math.max(0, Math.min(65535, Math.round(v)));
const i16 = (v: number): number => Math.max(-32768, Math.min(32767, Math.round(v)));

export function encodeUplink(p: DecodedPayload): Uint8Array {
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, u16(p.pm25 * 10), true);
  view.setUint16(2, u16(p.pm10 * 10), true);
  view.setInt16(4, i16(p.temperature * 100), true);
  view.setUint16(6, u16(p.humidity * 100), true);
  view.setUint16(8, u16(p.pressure), true);
  view.setUint16(10, u16(p.batteryMv), true);
  // Mirror the firmware: version + presence bits (every sensor unless told otherwise).
  const present = p.sensorsPresent ?? { pm: true, env: true };
  bytes[12] = PAYLOAD_VERSION | (present.pm ? PRESENT_PM : 0) | (present.env ? PRESENT_ENV : 0);
  return bytes;
}

// ============================ Downlink config ===============================
// Small commands pushed to a node via a LoRaWAN Class-A downlink so config
// changes never need a reflash. Mirrors firmware/core/aq_downlink.{h,c}. Sent on
// fPort DOWNLINK_FPORT. Format: [opcode:1][args… little-endian].

export const DOWNLINK_FPORT = 10;

export const DownlinkOpcode = {
  SetInterval: 0x01, // uint16 LE seconds
  SetPmOffset: 0x02, // int16 LE, µg/m³ ×10
  SetTempOffset: 0x03, // int16 LE, °C ×100
} as const;

export type DownlinkCommand =
  | { command: 'setInterval'; seconds: number }
  | { command: 'setPmOffset'; offsetX10: number }
  | { command: 'setTempOffset'; offsetX100: number };

/** Ranges the firmware accepts (AQ_INTERVAL_* / AQ_*_OFFSET_MAX_* in aq_downlink.h).
 * A node rejects anything outside them and keeps its current setting. */
export const DOWNLINK_LIMITS = {
  intervalMinS: 120,
  intervalMaxS: 21600,
  pmOffsetMaxX10: 500,
  tempOffsetMaxX100: 1000,
} as const;

function checkRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}, got ${value}`);
  }
}

/** Throw a RangeError if the node would reject `cmd`. */
export function assertDownlinkInRange(cmd: DownlinkCommand): void {
  const l = DOWNLINK_LIMITS;
  switch (cmd.command) {
    case 'setInterval':
      checkRange('seconds', cmd.seconds, l.intervalMinS, l.intervalMaxS);
      break;
    case 'setPmOffset':
      checkRange('offsetX10', cmd.offsetX10, -l.pmOffsetMaxX10, l.pmOffsetMaxX10);
      break;
    case 'setTempOffset':
      checkRange('offsetX100', cmd.offsetX100, -l.tempOffsetMaxX100, l.tempOffsetMaxX100);
      break;
  }
}

/** Encode a config command. Refuses (RangeError) a value the node would reject. */
export function encodeDownlink(cmd: DownlinkCommand): Uint8Array {
  assertDownlinkInRange(cmd);
  const bytes = new Uint8Array(3);
  const view = new DataView(bytes.buffer);
  switch (cmd.command) {
    case 'setInterval':
      bytes[0] = DownlinkOpcode.SetInterval;
      view.setUint16(1, cmd.seconds, true);
      return bytes;
    case 'setPmOffset':
      bytes[0] = DownlinkOpcode.SetPmOffset;
      view.setInt16(1, cmd.offsetX10, true);
      return bytes;
    case 'setTempOffset':
      bytes[0] = DownlinkOpcode.SetTempOffset;
      view.setInt16(1, cmd.offsetX100, true);
      return bytes;
  }
}

/** Decode the bytes on the wire. Does not range-check: a node receiving an
 * out-of-range command decodes it and then rejects it. */
export function decodeDownlink(bytes: Uint8Array): DownlinkCommand {
  if (bytes.length < 3) {
    throw new Error(`Downlink too short: expected 3, got ${bytes.length}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  switch (bytes[0]) {
    case DownlinkOpcode.SetInterval:
      return { command: 'setInterval', seconds: view.getUint16(1, true) };
    case DownlinkOpcode.SetPmOffset:
      return { command: 'setPmOffset', offsetX10: view.getInt16(1, true) };
    case DownlinkOpcode.SetTempOffset:
      return { command: 'setTempOffset', offsetX100: view.getInt16(1, true) };
    default:
      throw new Error(`Unknown downlink command 0x${bytes[0].toString(16)}`);
  }
}

// ============================== Config report ===============================
// The uplink a node sends after a config downlink (and once after a cold boot)
// so the server can confirm which settings are active. Mirrors
// firmware/core/aq_config.{h,c}. Sent on fPort CONFIG_REPORT_FPORT, 9 bytes LE:
//   [version:1][lastResult:1][lastCommand:1][intervalS:u16][pmOffsetX10:i16]
//   [tempOffsetX100:i16]

export const CONFIG_REPORT_FPORT = 11;
export const CONFIG_REPORT_LENGTH = 9;
export const CONFIG_REPORT_VERSION = 1;

/** Result of the last config downlink, as the node reports it. */
export const ConfigResult = {
  None: 0, // no config downlink since boot
  Applied: 1,
  OutOfRange: 2, // rejected; config unchanged
  Malformed: 3, // rejected; config unchanged
} as const;
export type ConfigResult = (typeof ConfigResult)[keyof typeof ConfigResult];

export interface ConfigReport {
  version: number;
  lastResult: ConfigResult;
  /** Opcode of the last config downlink (see DownlinkOpcode), 0 = none since boot. */
  lastCommand: number;
  intervalS: number;
  pmOffsetX10: number;
  tempOffsetX100: number;
}

export function decodeConfigReport(bytes: Uint8Array): ConfigReport {
  if (bytes.length < CONFIG_REPORT_LENGTH) {
    throw new Error(
      `Config report too short: expected ${CONFIG_REPORT_LENGTH}, got ${bytes.length}`,
    );
  }
  const version = bytes[0];
  if (version !== CONFIG_REPORT_VERSION) {
    throw new Error(`Unsupported config report version ${version}`);
  }
  const lastResult = bytes[1];
  if (lastResult > ConfigResult.Malformed) {
    throw new Error(`Unknown config result ${lastResult}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    version,
    lastResult: lastResult as ConfigResult,
    lastCommand: bytes[2],
    intervalS: view.getUint16(3, true),
    pmOffsetX10: view.getInt16(5, true),
    tempOffsetX100: view.getInt16(7, true),
  };
}

/** Encode a config report as the firmware would (used by tests and tooling). */
export function encodeConfigReport(r: Omit<ConfigReport, 'version'>): Uint8Array {
  const bytes = new Uint8Array(CONFIG_REPORT_LENGTH);
  const view = new DataView(bytes.buffer);
  bytes[0] = CONFIG_REPORT_VERSION;
  bytes[1] = r.lastResult;
  bytes[2] = r.lastCommand;
  view.setUint16(3, r.intervalS, true);
  view.setInt16(5, r.pmOffsetX10, true);
  view.setInt16(7, r.tempOffsetX100, true);
  return bytes;
}

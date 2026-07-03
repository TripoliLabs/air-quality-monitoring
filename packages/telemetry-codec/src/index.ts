/**
 * LoRa uplink payload codec.
 *
 * THE SINGLE SOURCE OF TRUTH for the byte layout shared between the ESP32
 * firmware (C struct) and the ingestion service (TS decoder). Any change here
 * must be mirrored in firmware/. Layout (little-endian, 13 bytes):
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
  /** Which sensor groups the node reported as populated (present on decode). */
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

export function encodeUplink(p: DecodedPayload): Uint8Array {
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, Math.round(p.pm25 * 10), true);
  view.setUint16(2, Math.round(p.pm10 * 10), true);
  view.setInt16(4, Math.round(p.temperature * 100), true);
  view.setUint16(6, Math.round(p.humidity * 100), true);
  view.setUint16(8, Math.round(p.pressure), true);
  view.setUint16(10, Math.round(p.batteryMv), true);
  // Mirror the firmware: version + PM|ENV present.
  bytes[12] = PAYLOAD_VERSION | PRESENT_PM | PRESENT_ENV;
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

export function encodeDownlink(cmd: DownlinkCommand): Uint8Array {
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

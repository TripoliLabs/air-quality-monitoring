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
 *   12      1     reserved/flags  uint8
 */
export const PAYLOAD_LENGTH = 13;

export interface DecodedPayload {
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  pressure: number;
  batteryMv: number;
}

export function decodeUplink(bytes: Uint8Array): DecodedPayload {
  if (bytes.length < PAYLOAD_LENGTH) {
    throw new Error(`Payload too short: expected ${PAYLOAD_LENGTH}, got ${bytes.length}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    pm25: view.getUint16(0, true) / 10,
    pm10: view.getUint16(2, true) / 10,
    temperature: view.getInt16(4, true) / 100,
    humidity: view.getUint16(6, true) / 100,
    pressure: view.getUint16(8, true),
    batteryMv: view.getUint16(10, true),
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
  return bytes;
}

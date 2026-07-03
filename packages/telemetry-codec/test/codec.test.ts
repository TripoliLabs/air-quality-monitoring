import { describe, expect, it } from 'vitest';
import {
  decodeDownlink,
  decodeUplink,
  type DecodedPayload,
  type DownlinkCommand,
  encodeDownlink,
  encodeUplink,
  PAYLOAD_LENGTH,
  PAYLOAD_VERSION,
  PRESENT_ENV,
  PRESENT_PM,
} from '../src/index';

const sample: DecodedPayload = {
  pm25: 42.3,
  pm10: 78.5,
  temperature: 24.55,
  humidity: 61.2,
  pressure: 1013,
  batteryMv: 3950,
};

describe('telemetry codec', () => {
  it('encodes to a fixed-length payload', () => {
    const bytes = encodeUplink(sample);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(PAYLOAD_LENGTH);
  });

  it('round-trips values within the codec quantisation', () => {
    const decoded = decodeUplink(encodeUplink(sample));
    // pm ×10, temp/humidity ×100 → bounded rounding error.
    expect(decoded.pm25).toBeCloseTo(sample.pm25, 1);
    expect(decoded.pm10).toBeCloseTo(sample.pm10, 1);
    expect(decoded.temperature).toBeCloseTo(sample.temperature, 1);
    expect(decoded.humidity).toBeCloseTo(sample.humidity, 1);
    expect(decoded.pressure).toBe(sample.pressure);
    expect(decoded.batteryMv).toBe(sample.batteryMv);
  });

  it('handles negative temperatures (int16)', () => {
    const decoded = decodeUplink(encodeUplink({ ...sample, temperature: -12.5 }));
    expect(decoded.temperature).toBeCloseTo(-12.5, 1);
  });

  it('throws on a short payload', () => {
    expect(() => decodeUplink(new Uint8Array(5))).toThrow(/too short/i);
  });

  it('decodes a known byte sequence deterministically', () => {
    // pm25=10.0 → 100 (0x0064 LE), rest zero.
    const bytes = new Uint8Array(PAYLOAD_LENGTH);
    bytes[0] = 0x64;
    bytes[1] = 0x00;
    expect(decodeUplink(bytes).pm25).toBe(10);
  });

  it('encodes byte 12 as version + PM|ENV presence', () => {
    const bytes = encodeUplink(sample);
    expect(bytes[12]).toBe(PAYLOAD_VERSION | PRESENT_PM | PRESENT_ENV);
  });

  it('decodes the version and sensor-presence bitmask', () => {
    const decoded = decodeUplink(encodeUplink(sample));
    expect(decoded.version).toBe(PAYLOAD_VERSION);
    expect(decoded.sensorsPresent).toEqual({ pm: true, env: true });
  });

  it('treats legacy version 0 (byte 12 = 0) as all sensors present', () => {
    const bytes = new Uint8Array(PAYLOAD_LENGTH); // byte 12 == 0
    const decoded = decodeUplink(bytes);
    expect(decoded.version).toBe(0);
    expect(decoded.sensorsPresent).toEqual({ pm: true, env: true });
  });

  it('reports a sensor as absent when its presence bit is clear', () => {
    const bytes = encodeUplink(sample);
    bytes[12] = PAYLOAD_VERSION | PRESENT_ENV; // PM bit cleared
    const decoded = decodeUplink(bytes);
    expect(decoded.sensorsPresent).toEqual({ pm: false, env: true });
  });

  it('throws on an unsupported (future) payload version', () => {
    const bytes = encodeUplink(sample);
    bytes[12] = PAYLOAD_VERSION + 1; // version 2, unknown to this decoder
    expect(() => decodeUplink(bytes)).toThrow(/unsupported payload version/i);
  });
});

describe('downlink config codec', () => {
  const cases: DownlinkCommand[] = [
    { command: 'setInterval', seconds: 600 },
    { command: 'setPmOffset', offsetX10: -35 },
    { command: 'setTempOffset', offsetX100: 250 },
  ];

  it.each(cases)('round-trips %o', (cmd) => {
    expect(decodeDownlink(encodeDownlink(cmd))).toEqual(cmd);
  });

  it('encodes a known set-interval command', () => {
    const bytes = encodeDownlink({ command: 'setInterval', seconds: 600 });
    expect([...bytes]).toEqual([0x01, 0x58, 0x02]); // 600 = 0x0258 LE
  });

  it('throws on an unknown opcode', () => {
    expect(() => decodeDownlink(new Uint8Array([0x7f, 0, 0]))).toThrow(/unknown downlink/i);
  });

  it('throws on a short downlink', () => {
    expect(() => decodeDownlink(new Uint8Array([0x01]))).toThrow(/too short/i);
  });
});

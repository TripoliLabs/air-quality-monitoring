import { describe, expect, it } from 'vitest';
import { decodeUplink, encodeUplink, PAYLOAD_LENGTH, type DecodedPayload } from '../src/index';

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
});

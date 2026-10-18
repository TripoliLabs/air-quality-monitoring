import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ConfigResult,
  type DownlinkCommand,
  decodeConfigReport,
  decodeDownlink,
  decodeUplink,
  encodeConfigReport,
  encodeDownlink,
  encodeUplink,
  PRESENT_ENV,
  PRESENT_PM,
} from '../src/index';

// The vectors in ../vectors are shared with the firmware: firmware/test/test_vectors.c
// reads the same files, so the C and TypeScript codecs cannot drift apart without
// one of the two suites failing.

type Row = Record<string, string>;

function loadVectors(file: string): Row[] {
  const lines = readFileSync(join(__dirname, '../vectors', file), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line !== '' && !line.startsWith('#'));
  const [header, ...rows] = lines.map((line) => line.split(','));
  return rows.map((cells) => {
    if (cells.length !== header.length) {
      throw new Error(`${file}: "${cells[0]}" has ${cells.length} columns, not ${header.length}`);
    }
    return Object.fromEntries(header.map((name, i) => [name, cells[i]]));
  });
}

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const fromHex = (hex: string): Uint8Array => new Uint8Array(Buffer.from(hex, 'hex'));

describe('shared uplink vectors', () => {
  const vectors = loadVectors('uplink.csv');
  // A `-` reading marks bytes that no current encoder emits (legacy firmware).
  const encodable = vectors.filter((v) => v.pm25 !== '-');

  it('loads the vector file', () => {
    expect(vectors.length).toBeGreaterThan(0);
    expect(encodable.length).toBeGreaterThan(0);
  });

  it.each(encodable)('encodes $name to the expected bytes', (v) => {
    const present = Number(v.present);
    const bytes = encodeUplink({
      pm25: Number(v.pm25),
      pm10: Number(v.pm10),
      temperature: Number(v.temperature),
      humidity: Number(v.humidity),
      pressure: Number(v.pressure),
      batteryMv: Number(v.battery_mv),
      sensorsPresent: { pm: (present & PRESENT_PM) !== 0, env: (present & PRESENT_ENV) !== 0 },
    });
    expect(toHex(bytes)).toBe(v.hex);
  });

  it.each(vectors)('decodes $name', (v) => {
    expect(decodeUplink(fromHex(v.hex))).toEqual({
      pm25: Number(v.dec_pm25),
      pm10: Number(v.dec_pm10),
      temperature: Number(v.dec_temperature),
      humidity: Number(v.dec_humidity),
      pressure: Number(v.dec_pressure),
      batteryMv: Number(v.dec_battery_mv),
      version: Number(v.dec_version),
      sensorsPresent: { pm: v.dec_pm === '1', env: v.dec_env === '1' },
    });
  });
});

describe('shared downlink vectors', () => {
  const vectors = loadVectors('downlink.csv');

  function toCommand(v: Row): DownlinkCommand {
    const value = Number(v.value);
    switch (v.command) {
      case 'setInterval':
        return { command: 'setInterval', seconds: value };
      case 'setPmOffset':
        return { command: 'setPmOffset', offsetX10: value };
      case 'setTempOffset':
        return { command: 'setTempOffset', offsetX100: value };
      default:
        throw new Error(`downlink.csv: unknown command "${v.command}" in "${v.name}"`);
    }
  }

  it('loads the vector file', () => {
    expect(vectors.length).toBeGreaterThan(0);
  });

  it('has both accepted and rejected rows', () => {
    expect(vectors.every((v) => v.result === 'applied' || v.result === 'out_of_range')).toBe(true);
    expect(vectors.some((v) => v.result === 'out_of_range')).toBe(true);
  });

  const applied = vectors.filter((v) => v.result === 'applied');
  const rejected = vectors.filter((v) => v.result === 'out_of_range');

  it.each(applied)('encodes $name to the expected bytes', (v) => {
    expect(toHex(encodeDownlink(toCommand(v)))).toBe(v.hex);
  });

  // The server must never queue a command the node would throw away.
  it.each(rejected)('refuses to encode $name', (v) => {
    expect(() => encodeDownlink(toCommand(v))).toThrow(RangeError);
  });

  it.each(vectors)('decodes $name back to the command', (v) => {
    expect(decodeDownlink(fromHex(v.hex))).toEqual(toCommand(v));
  });
});

describe('shared config report vectors', () => {
  const vectors = loadVectors('report.csv');

  const toReport = (v: Row) => ({
    lastResult: Number(v.result) as ConfigResult,
    lastCommand: Number(v.last_cmd),
    intervalS: Number(v.interval),
    pmOffsetX10: Number(v.pm_offset_x10),
    tempOffsetX100: Number(v.temp_offset_x100),
  });

  it('loads the vector file', () => {
    expect(vectors.length).toBeGreaterThan(0);
  });

  it.each(vectors)('decodes $name', (v) => {
    expect(decodeConfigReport(fromHex(v.hex))).toEqual({ version: 1, ...toReport(v) });
  });

  it.each(vectors)('encodes $name to the expected bytes', (v) => {
    expect(toHex(encodeConfigReport(toReport(v)))).toBe(v.hex);
  });
});

/**
 * Ingestion integration test. Runs against a LIVE stack (`docker compose up -d`).
 * Publishes a ChirpStack uplink to the broker and asserts the ingestion service
 * decoded the codec payload, computed the AQI, and persisted + cached the reading
 * (observed via the API's Redis-backed latest endpoint).
 *   pnpm --filter @aq/ingestion test:integration
 */
import { encodeUplink } from '@aq/telemetry-codec';
import { connect, type MqttClient } from 'mqtt';
import { describe, expect, it } from 'vitest';

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const API = process.env.API_URL ?? 'http://localhost:3000';
const APP = '00000000-0000-0000-0000-000000000001';
// A device NOT in the fixtures, so the simulator never overwrites our value.
const TEST_EUI = 'eeeeeeee00000001';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('ingestion integration', () => {
  it('decodes an uplink and persists + caches the reading with AQI', async () => {
    const client = await new Promise<MqttClient>((resolve, reject) => {
      const c = connect(MQTT_URL);
      c.on('connect', () => resolve(c));
      c.on('error', reject);
    });

    const payload = encodeUplink({
      pm25: 88.8,
      pm10: 120.5,
      temperature: 27.3,
      humidity: 55,
      pressure: 1011,
      batteryMv: 3800,
    });
    const uplink = {
      deviceInfo: { devEui: TEST_EUI, deviceName: 'integration-test' },
      fPort: 2,
      fCnt: 1,
      data: Buffer.from(payload).toString('base64'),
      time: new Date().toISOString(),
      rxInfo: [{ gatewayId: 'ac1f09fffe0000ff', rssi: -70, snr: 8.0 }],
    };

    client.publish(`application/${APP}/device/${TEST_EUI}/event/up`, JSON.stringify(uplink), { qos: 0 });

    // Poll the API's latest cache until ingestion has processed our uplink.
    let latest: Record<string, number> | null = null;
    for (let i = 0; i < 30; i++) {
      const res = await fetch(`${API}/sensors/${TEST_EUI}/latest`);
      if (res.status === 200) {
        const body = (await res.json()) as Record<string, number>;
        if (Math.abs(body.pm25 - 88.8) < 0.2) {
          latest = body;
          break;
        }
      }
      await sleep(400);
    }
    await client.endAsync();

    expect(latest, 'ingestion did not process the uplink in time').toBeTruthy();
    expect(latest?.pm25).toBeCloseTo(88.8, 1);
    expect(latest?.pm10).toBeCloseTo(120.5, 1);
    expect(latest?.temperature).toBeCloseTo(27.3, 1);
    expect(latest?.signalStrength).toBe(-70);
    // PM2.5 88.8 µg/m³ sits in the "unhealthy" band.
    expect(latest?.aqi).toBeGreaterThan(150);
  }, 20_000);
});

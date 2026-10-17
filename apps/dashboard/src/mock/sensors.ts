/**
 * Simulated sensor fleet for local development — ten Tripoli neighbourhoods,
 * each with its own pollution profile. Never part of a production build.
 */

import type { Sensor } from '../types';

interface MockNeighborhood {
  id: string;
  name: string;
  nameAr: string;
  center: [latitude: number, longitude: number];
  /** Typical PM2.5 level (µg/m³) the simulated readings vary around. */
  basePm25: number;
  sensorCount: number;
}

const hood = (
  id: string,
  name: string,
  nameAr: string,
  center: [number, number],
  basePm25: number,
  sensorCount: number,
): MockNeighborhood => ({ id, name, nameAr, center, basePm25, sensorCount });

const NEIGHBORHOODS: MockNeighborhood[] = [
  hood('downtown', 'Downtown', 'وسط المدينة', [34.4367, 35.8497], 30, 6),
  hood('al-mina', 'Al-Mina', 'الميناء', [34.4483, 35.8239], 14, 7),
  hood('el-tal', 'El-Tal', 'التل', [34.4345, 35.8455], 34, 5),
  hood('abu-samra', 'Abu Samra', 'أبو سمرا', [34.4253, 35.8567], 22, 6),
  hood('bab-al-tabbaneh', 'Bab al-Tabbaneh', 'باب التبانة', [34.4412, 35.8521], 44, 5),
  hood('al-qobbeh', 'Al-Qobbeh', 'القبة', [34.4298, 35.8612], 28, 5),
  hood('azmi', 'Azmi', 'عزمي', [34.4389, 35.8435], 18, 4),
  hood('bahsas', 'Bahsas', 'البحصاص', [34.4221, 35.8289], 24, 4),
  hood('al-zahrieh', 'Al-Zahrieh', 'الزاهرية', [34.4396, 35.8565], 26, 4),
  hood('port-area', 'Port Area', 'منطقة المرفأ', [34.4535, 35.8325], 52, 6),
];

export interface MockSensor extends Sensor {
  basePm25: number;
  /** Stable per-sensor number in [0, 1) that offsets its readings. */
  seed: number;
  /** How long ago the sensor went quiet, if it has; undefined means reporting. */
  silentForMs?: number;
}

/** Deterministic pseudo-random in [0, 1), so the fleet is the same on every reload. */
export function seeded(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const HOUR = 3_600_000;

function quietFor(seed: number, lostContact: boolean, retired: boolean): number | undefined {
  if (lostContact) return (2 + seeded(seed + 500) * 20) * HOUR;
  return retired ? 9 * 24 * HOUR : undefined;
}

function generate(): MockSensor[] {
  const sensors: MockSensor[] = [];
  let index = 1;
  for (const place of NEIGHBORHOODS) {
    for (let i = 0; i < place.sensorCount; i++) {
      const seed = index * 7 + i * 13;
      const roll = seeded(seed + 200);
      // About one in ten is not reporting: half lost contact, half retired.
      const lostContact = roll >= 0.9 && roll < 0.95;
      const retired = roll >= 0.95;
      const installed = Date.UTC(2025, 8, 1) + Math.floor(seeded(seed + 100) * 120) * 24 * HOUR;

      sensors.push({
        id: `sim-${String(index).padStart(3, '0')}`,
        name: `${place.name} ${i + 1}`,
        nameAr: `${place.nameAr} ${i + 1}`,
        neighborhood: place.name,
        neighborhoodAr: place.nameAr,
        neighborhoodId: place.id,
        latitude: place.center[0] + (seeded(seed) - 0.5) * 0.007,
        longitude: place.center[1] + (seeded(seed + 50) - 0.5) * 0.008,
        isActive: !retired,
        installDate: new Date(installed).toISOString().slice(0, 10),
        basePm25: place.basePm25 * (0.85 + seeded(seed + 300) * 0.3),
        seed: seeded(seed + 400),
        silentForMs: quietFor(seed, lostContact, retired),
      });
      index++;
    }
  }
  return sensors;
}

export const MOCK_SENSORS: MockSensor[] = generate();

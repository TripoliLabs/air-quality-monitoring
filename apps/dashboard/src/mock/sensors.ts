/**
 * Static sensor definitions for Tripoli, Lebanon
 * Many sensors per neighborhood, real GPS coordinates with jitter
 */

export interface NeighborhoodDefinition {
  id: string;
  name: string;
  nameAr: string;
  center: { latitude: number; longitude: number };
  /** Base PM2.5 range for this neighborhood's pollution profile */
  basePm25: { min: number; max: number };
  sensorCount: number;
}

export interface SensorDefinition {
  id: string;
  name: string;
  nameAr: string;
  neighborhoodId: string;
  location: {
    latitude: number;
    longitude: number;
    neighborhood: string;
    neighborhoodAr: string;
  };
  status: 'online' | 'offline' | 'maintenance';
  installDate: string;
  /** Base PM2.5 range inherited from neighborhood */
  basePm25: { min: number; max: number };
}

export const TRIPOLI_CENTER = {
  latitude: 34.4367,
  longitude: 35.8497,
  zoom: 12.8,
};

export const NEIGHBORHOODS: NeighborhoodDefinition[] = [
  {
    id: 'downtown',
    name: 'Downtown',
    nameAr: 'وسط المدينة',
    center: { latitude: 34.4367, longitude: 35.8497 },
    basePm25: { min: 20, max: 55 },
    sensorCount: 6,
  },
  {
    id: 'al-mina',
    name: 'Al-Mina',
    nameAr: 'الميناء',
    center: { latitude: 34.4483, longitude: 35.8239 },
    basePm25: { min: 15, max: 45 },
    sensorCount: 7,
  },
  {
    id: 'el-tal',
    name: 'El-Tal',
    nameAr: 'التل',
    center: { latitude: 34.4345, longitude: 35.8455 },
    basePm25: { min: 25, max: 60 },
    sensorCount: 5,
  },
  {
    id: 'abu-samra',
    name: 'Abu Samra',
    nameAr: 'أبو سمرا',
    center: { latitude: 34.4253, longitude: 35.8567 },
    basePm25: { min: 18, max: 50 },
    sensorCount: 6,
  },
  {
    id: 'bab-al-tabbaneh',
    name: 'Bab al-Tabbaneh',
    nameAr: 'باب التبانة',
    center: { latitude: 34.4412, longitude: 35.8521 },
    basePm25: { min: 30, max: 70 },
    sensorCount: 5,
  },
  {
    id: 'al-qobbeh',
    name: 'Al-Qobbeh',
    nameAr: 'القبة',
    center: { latitude: 34.4298, longitude: 35.8612 },
    basePm25: { min: 22, max: 55 },
    sensorCount: 5,
  },
  {
    id: 'azmi',
    name: 'Azmi',
    nameAr: 'العزمي',
    center: { latitude: 34.4389, longitude: 35.8435 },
    basePm25: { min: 15, max: 40 },
    sensorCount: 4,
  },
  {
    id: 'bahsas',
    name: 'Bahsas',
    nameAr: 'بحصاص',
    center: { latitude: 34.4321, longitude: 35.8389 },
    basePm25: { min: 20, max: 50 },
    sensorCount: 4,
  },
  {
    id: 'al-zahrieh',
    name: 'Al-Zahrieh',
    nameAr: 'الزاهرية',
    center: { latitude: 34.4356, longitude: 35.8535 },
    basePm25: { min: 18, max: 45 },
    sensorCount: 4,
  },
  {
    id: 'port-area',
    name: 'Port Area',
    nameAr: 'منطقة المرفأ',
    center: { latitude: 34.4515, longitude: 35.8285 },
    basePm25: { min: 35, max: 80 },
    sensorCount: 6,
  },
];

/**
 * Deterministic pseudo-random for consistent sensor placement.
 * Seeded by sensor index so positions stay stable across reloads.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Generate ~100-200m GPS jitter (approx 0.001-0.002 degrees) */
function jitterCoord(base: number, seed: number): number {
  return base + (seededRandom(seed) - 0.5) * 0.004;
}

function generateSensors(): SensorDefinition[] {
  const sensors: SensorDefinition[] = [];
  let globalIndex = 1;
  const installBaseDate = new Date('2025-09-01');

  for (const neighborhood of NEIGHBORHOODS) {
    for (let i = 0; i < neighborhood.sensorCount; i++) {
      const seed = globalIndex * 7 + i * 13;
      const id = `sensor_${String(globalIndex).padStart(3, '0')}`;

      // Spread install dates over several months
      const installOffset = Math.floor(seededRandom(seed + 100) * 120); // 0-120 days
      const installDate = new Date(installBaseDate.getTime() + installOffset * 86400000);
      const installStr = installDate.toISOString().split('T')[0];

      // 90% online, 5% offline, 5% maintenance
      const statusRoll = seededRandom(seed + 200);
      const status: SensorDefinition['status'] =
        statusRoll < 0.9 ? 'online' : statusRoll < 0.95 ? 'offline' : 'maintenance';

      sensors.push({
        id,
        name: `${neighborhood.name} #${i + 1}`,
        nameAr: `${neighborhood.nameAr} #${i + 1}`,
        neighborhoodId: neighborhood.id,
        location: {
          latitude: jitterCoord(neighborhood.center.latitude, seed),
          longitude: jitterCoord(neighborhood.center.longitude, seed + 50),
          neighborhood: neighborhood.name,
          neighborhoodAr: neighborhood.nameAr,
        },
        status,
        installDate: installStr,
        basePm25: neighborhood.basePm25,
      });

      globalIndex++;
    }
  }

  return sensors;
}

export const SENSORS: SensorDefinition[] = generateSensors();

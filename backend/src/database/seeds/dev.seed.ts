import { randomUUID } from 'node:crypto';
import AppDataSource from '../data-source';
import { Reading } from '../entities/reading.entity';
import { Sensor } from '../entities/sensor.entity';

type SeedSensor = Pick<
  Sensor,
  'id' | 'deviceId' | 'name' | 'description' | 'latitude' | 'longitude' | 'neighborhood'
>;

const seedSensors: SeedSensor[] = [
  {
    id: '70b9d6d9-54c6-4f74-9d7f-8fb4c7358c61',
    deviceId: 'A1B2C3D4E5F60001',
    name: 'Tripoli Port Station',
    description: 'Development seed sensor covering the port district.',
    latitude: 34.4599001,
    longitude: 35.8498001,
    neighborhood: 'Port',
  },
  {
    id: 'ef0ed79b-0af0-4d0a-a0f2-019d9f6e9bf1',
    deviceId: 'A1B2C3D4E5F60002',
    name: 'Mina Corniche Station',
    description: 'Development seed sensor near the Corniche.',
    latitude: 34.4522002,
    longitude: 35.8168002,
    neighborhood: 'Mina',
  },
  {
    id: 'f553b71f-4450-4ee5-b6b1-b7fe91fd4f55',
    deviceId: 'A1B2C3D4E5F60003',
    name: 'Tall Station',
    description: 'Development seed sensor for the Tall district.',
    latitude: 34.4369003,
    longitude: 35.8368003,
    neighborhood: 'Tall',
  },
];

function round(value: number, scale: number): number {
  return Number.parseFloat(value.toFixed(scale));
}

function calculateAqiCategory(aqi: number): string {
  if (aqi <= 50) {
    return 'Good';
  }

  if (aqi <= 100) {
    return 'Moderate';
  }

  if (aqi <= 150) {
    return 'Unhealthy for Sensitive Groups';
  }

  if (aqi <= 200) {
    return 'Unhealthy';
  }

  if (aqi <= 300) {
    return 'Very Unhealthy';
  }

  return 'Hazardous';
}

function calculateAqi(pm25: number, pm10: number): number {
  return Math.min(500, Math.round(pm25 * 2.4 + pm10 * 0.6));
}

function buildReadings(sensor: SeedSensor, sensorIndex: number): Reading[] {
  const readings: Reading[] = [];
  const now = Date.now();
  const sensorRepository = AppDataSource.getRepository(Reading);

  for (let hourOffset = 48; hourOffset >= 0; hourOffset -= 1) {
    const timestamp = new Date(now - hourOffset * 60 * 60 * 1000);
    const phase = (48 - hourOffset + sensorIndex * 3) / 6;
    const pm25 = round(18 + sensorIndex * 7 + Math.sin(phase) * 12 + hourOffset * 0.05, 2);
    const pm10 = round(pm25 + 11 + Math.cos(phase) * 6, 2);
    const pm1 = round(pm25 * 0.62, 2);
    const temperature = round(19 + sensorIndex * 1.5 + Math.sin(phase / 2) * 4, 2);
    const humidity = round(56 + Math.cos(phase / 2) * 14, 2);
    const pressure = round(1008 + Math.sin(phase / 3) * 5, 2);
    const aqi = calculateAqi(pm25, pm10);

    readings.push(
      sensorRepository.create({
        id: randomUUID(),
        sensorId: sensor.id,
        timestamp,
        pm25,
        pm10,
        pm1,
        temperature,
        humidity,
        pressure,
        aqi,
        aqiCategory: calculateAqiCategory(aqi),
        batteryMv: 3980 - hourOffset * 2 - sensorIndex * 10,
        signalStrength: -88 + sensorIndex * 5 - (hourOffset % 6),
      }),
    );
  }

  return readings;
}

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const sensorRepository = AppDataSource.getRepository(Sensor);
  const existingSensors = await sensorRepository.find({
    where: seedSensors.map((sensor) => ({ deviceId: sensor.deviceId })),
  });

  if (existingSensors.length === seedSensors.length) {
    const existingReadings = await AppDataSource.createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from(Reading, 'reading')
      .where('reading.sensorId IN (:...sensorIds)', {
        sensorIds: seedSensors.map((sensor) => sensor.id),
      })
      .getRawOne<{ count: string }>();

    if (Number(existingReadings?.count ?? '0') > 0) {
      console.log('Development seed data already exists, skipping.');
      await AppDataSource.destroy();
      return;
    }
  }

  const sensorsToInsert = seedSensors.map((sensor, index) =>
    sensorRepository.create({
      ...sensor,
      isActive: true,
      lastSeenAt: new Date(),
      batteryMv: 3960 - index * 15,
      signalStrength: -82 + index * 4,
    }),
  );

  await sensorRepository.save(sensorsToInsert, { chunk: seedSensors.length });

  const readingRepository = AppDataSource.getRepository(Reading);
  const readings = seedSensors.flatMap((sensor, index) => buildReadings(sensor, index));
  await readingRepository.save(readings, { chunk: 100 });

  console.log(
    `Seeded ${seedSensors.length} sensors and ${readings.length} readings into TimescaleDB.`,
  );

  await AppDataSource.destroy();
}

seed().catch(async (error) => {
  console.error('Failed to seed development data.');
  console.error(error);

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exitCode = 1;
});

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Reading } from './entities/reading.entity';
import { Sensor } from './entities/sensor.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'timescaledb',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'airquality',
  password: process.env.DB_PASSWORD ?? 'airquality',
  database: process.env.DB_NAME ?? 'airquality',

  entities: [Sensor, Reading],
  migrations: ['src/database/migrations/*{.ts,.js}'],

  synchronize: false,

  logging: (process.env.TYPEORM_LOGGING ?? 'false') === 'true',
});

export default AppDataSource;

// backend/src/database/entities/reading.entity.ts

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Sensor } from './sensor.entity';

@Entity('readings')
@Index(['sensorId', 'time'])
export class Reading {
  // The DB schema in the screenshot doesn't define a PK.
  // TypeORM requires one, so we use a composite key in the entity mapping.
  @PrimaryColumn({ name: 'time', type: 'timestamptz' })
  time!: Date;

  @PrimaryColumn({ name: 'sensor_id', type: 'uuid' })
  sensorId!: string;

  @ManyToOne(() => Sensor, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'sensor_id' })
  sensor?: Sensor;

  @Column({ name: 'pm2_5', type: 'real', nullable: true })
  pm25?: number;

  @Column({ name: 'pm10', type: 'real', nullable: true })
  pm10?: number;

  @Column({ name: 'temperature', type: 'real', nullable: true })
  temperature?: number;

  @Column({ name: 'humidity', type: 'real', nullable: true })
  humidity?: number;

  @Column({ name: 'pressure', type: 'real', nullable: true })
  pressure?: number;

  @Column({ name: 'aqi', type: 'int', nullable: true })
  aqi?: number;

  @Column({ name: 'battery_mv', type: 'int', nullable: true })
  batteryMv?: number;

  @Column({ name: 'rssi', type: 'int', nullable: true })
  rssi?: number;
}
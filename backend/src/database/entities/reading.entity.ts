/**
 * Reading Entity
 * Air quality measurement from a sensor
 * Stored in TimescaleDB hypertable for efficient time-series queries
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sensor } from './sensor.entity';

@Entity('readings')
@Index(['sensorId', 'timestamp'])
export class Reading {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  sensorId!: string;

  @ManyToOne(
    () => Sensor,
    (sensor) => sensor.readings,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'sensorId' })
  sensor!: Sensor;

  @PrimaryColumn('timestamptz')
  @Index()
  timestamp!: Date;

  // PM measurements (µg/m³)
  @Column('decimal', { precision: 6, scale: 2 })
  pm25!: number;

  @Column('decimal', { precision: 6, scale: 2 })
  pm10!: number;

  @Column('decimal', { precision: 6, scale: 2, nullable: true })
  pm1?: number;

  // Environmental measurements
  @Column('decimal', { precision: 5, scale: 2 })
  temperature!: number; // Celsius

  @Column('decimal', { precision: 5, scale: 2 })
  humidity!: number; // Percentage

  @Column('decimal', { precision: 7, scale: 2, nullable: true })
  pressure?: number; // hPa

  // Calculated AQI (Air Quality Index)
  @Column('int')
  aqi!: number;

  @Column({ nullable: true })
  aqiCategory?: string; // Good, Moderate, Unhealthy, etc.

  // Metadata
  @Column('int', { nullable: true })
  batteryMv?: number;

  @Column('int', { nullable: true })
  signalStrength?: number; // RSSI in dBm

  @CreateDateColumn()
  createdAt!: Date;
}

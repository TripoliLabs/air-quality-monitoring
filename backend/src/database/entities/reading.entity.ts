/**
 * Reading Entity
 * Air quality measurement from a sensor
 * Stored in TimescaleDB hypertable for efficient time-series queries
 */

import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('readings')
@Index(['sensorId', 'time'])
export class Reading {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sensor_id', type: 'uuid' })
  @Index('readings_sensor_id_idx')
  sensorId!: string;

  // TimescaleDB time column
  @Column({ name: 'time', type: 'timestamptz' })
  @Index('readings_time_idx')
  time!: Date;

  // PM measurements (µg/m³)
  // NOTE: using REAL (float4) for time-series metrics keeps storage + aggregation fast.
  @Column({ name: 'pm2_5', type: 'real' })
  pm25!: number;

  @Column({ name: 'pm10', type: 'real' })
  pm10!: number;

  @Column({ name: 'pm1', type: 'real', nullable: true })
  pm1?: number;

  // Environmental measurements
  @Column({ name: 'temperature', type: 'real' })
  temperature!: number; // Celsius

  @Column({ name: 'humidity', type: 'real' })
  humidity!: number; // Percentage

  @Column({ name: 'pressure', type: 'real', nullable: true })
  pressure?: number; // hPa

  // Calculated AQI (Air Quality Index)
  @Column({ name: 'aqi', type: 'int' })
  aqi!: number;

  @Column({ name: 'aqi_category', type: 'text', nullable: true })
  aqiCategory?: string;

  // Metadata
  @Column('int', { name: 'battery_mv', nullable: true })
  batteryMv?: number;

  @Column('int', { name: 'signal_strength', nullable: true })
  signalStrength?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

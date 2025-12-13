/**
 * Sensor Entity
 * Represents a physical air quality sensor node
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sensors')
export class Sensor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  deviceId!: string; // LoRaWAN DevEUI

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column('decimal', { precision: 10, scale: 7 })
  latitude!: number;

  @Column('decimal', { precision: 10, scale: 7 })
  longitude!: number;

  @Column({ nullable: true })
  neighborhood?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  lastSeenAt?: Date;

  @Column('int', { nullable: true })
  batteryMv?: number;

  @Column('int', { nullable: true })
  signalStrength?: number; // RSSI in dBm

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations
  // @OneToMany(() => Reading, (reading) => reading.sensor)
  // readings: Reading[];
}

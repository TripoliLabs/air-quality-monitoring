// backend/src/database/entities/sensor.entity.ts

import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sensors')
export class Sensor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('sensors_device_eui_idx')
  @Column({ name: 'device_eui', type: 'varchar', length: 16, unique: true })
  deviceEui!: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true })
  name?: string;

  // Keep DECIMAL as string to avoid JS float rounding issues
  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude?: string;

  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: string;

  @Column({ name: 'neighborhood', type: 'varchar', length: 100, nullable: true })
  neighborhood?: string;

  @Column({ name: 'installed_at', type: 'timestamptz', nullable: true })
  installedAt?: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true, nullable: true })
  isActive?: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}

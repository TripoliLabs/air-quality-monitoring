import type { Sensor, SensorStatus } from '@aq/contracts';
import { type RelationalDb, sensors, type TelemetryDb } from '@aq/db';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { RELATIONAL_DB, TELEMETRY_DB } from '../database/database.module';
import type { CreateSensorDto, UpdateSensorDto } from '../dto';

export interface UnregisteredDevice {
  deviceId: string;
  lastSeen: string;
  readingCount: number;
}

@Injectable()
export class SensorsService {
  constructor(
    @Inject(RELATIONAL_DB) private readonly relational: RelationalDb,
    @Inject(TELEMETRY_DB) private readonly telemetry: TelemetryDb,
  ) {}

  /**
   * List all sensors. Can optionally filter by status or simulation flag.
   */
  async findAll(options?: {
    status?: SensorStatus;
    includeSimulated?: boolean;
  }): Promise<Sensor[]> {
    const query = this.relational.select().from(sensors);
    const rows = await query;

    let filtered = rows;
    if (options?.status) {
      filtered = filtered.filter((r) => r.status === options.status);
    }
    if (options?.includeSimulated === false) {
      filtered = filtered.filter((r) => !r.isSimulated);
    }

    return filtered.map(this.toSensorResponse);
  }

  /**
   * Find a single sensor by its DevEUI.
   */
  async findByDeviceId(deviceId: string): Promise<Sensor> {
    const normalized = deviceId.trim().toLowerCase();
    const [row] = await this.relational
      .select()
      .from(sensors)
      .where(eq(sensors.deviceId, normalized))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Sensor with device ID ${deviceId} not found`);
    }

    return this.toSensorResponse(row);
  }

  /**
   * Register a new sensor in the registry.
   */
  async create(dto: CreateSensorDto): Promise<Sensor> {
    const normalized = dto.deviceId.trim().toLowerCase();

    const [existing] = await this.relational
      .select({ id: sensors.id })
      .from(sensors)
      .where(eq(sensors.deviceId, normalized))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Sensor with device ID ${normalized} is already registered`);
    }

    const status = dto.status ?? 'active';
    const [created] = await this.relational
      .insert(sensors)
      .values({
        deviceId: normalized,
        name: dto.name,
        description: dto.description ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        neighborhood: dto.neighborhood ?? null,
        status,
        isActive: status === 'active',
        installedAt: dto.installedAt ? new Date(dto.installedAt) : null,
        isSimulated: dto.isSimulated ?? false,
      })
      .returning();

    return this.toSensorResponse(created);
  }

  /**
   * Update an existing sensor's metadata or status.
   */
  async update(deviceId: string, dto: UpdateSensorDto): Promise<Sensor> {
    const normalized = deviceId.trim().toLowerCase();

    const [existing] = await this.relational
      .select()
      .from(sensors)
      .where(eq(sensors.deviceId, normalized))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Sensor with device ID ${deviceId} not found`);
    }

    const updateValues: Partial<typeof sensors.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateValues.name = dto.name;
    if (dto.description !== undefined) updateValues.description = dto.description;
    if (dto.latitude !== undefined) updateValues.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateValues.longitude = dto.longitude;
    if (dto.neighborhood !== undefined) updateValues.neighborhood = dto.neighborhood;
    if (dto.status !== undefined) {
      updateValues.status = dto.status;
      updateValues.isActive = dto.status === 'active';
    }
    if (dto.installedAt !== undefined) {
      updateValues.installedAt = dto.installedAt ? new Date(dto.installedAt) : null;
    }
    if (dto.isSimulated !== undefined) updateValues.isSimulated = dto.isSimulated;

    const [updated] = await this.relational
      .update(sensors)
      .set(updateValues)
      .where(eq(sensors.deviceId, normalized))
      .returning();

    return this.toSensorResponse(updated);
  }

  /**
   * Retire a sensor from active service (soft retirement).
   */
  async retire(deviceId: string): Promise<Sensor> {
    return this.update(deviceId, { status: 'retired' });
  }

  /**
   * Discover DevEUIs currently transmitting to TimescaleDB that are not yet registered.
   */
  async findUnregistered(): Promise<UnregisteredDevice[]> {
    const registeredRows = await this.relational
      .select({ deviceId: sensors.deviceId })
      .from(sensors);
    const registeredSet = new Set(registeredRows.map((r) => r.deviceId.toLowerCase()));

    const result = await this.telemetry.execute(sql`
      SELECT sensor_id AS "deviceId", MAX(time) AS "lastSeen", COUNT(*)::int AS "readingCount"
      FROM readings
      WHERE time >= NOW() - INTERVAL '7 days'
      GROUP BY sensor_id
      ORDER BY "lastSeen" DESC
      LIMIT 100
    `);

    const rows = result as unknown as Array<{
      deviceId: string;
      lastSeen: string | Date;
      readingCount: number;
    }>;

    return rows
      .filter((r) => !registeredSet.has(String(r.deviceId).toLowerCase()))
      .map((r) => ({
        deviceId: String(r.deviceId),
        lastSeen: new Date(r.lastSeen).toISOString(),
        readingCount: Number(r.readingCount),
      }));
  }

  private toSensorResponse(r: typeof sensors.$inferSelect): Sensor {
    return {
      id: r.id,
      deviceId: r.deviceId,
      name: r.name,
      description: r.description ?? undefined,
      latitude: r.latitude,
      longitude: r.longitude,
      neighborhood: r.neighborhood ?? undefined,
      status: r.status as SensorStatus,
      isActive: r.isActive,
      installedAt: r.installedAt ? r.installedAt.toISOString() : undefined,
      isSimulated: r.isSimulated,
      lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : undefined,
      batteryMv: r.batteryMv ?? undefined,
      createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
    };
  }
}

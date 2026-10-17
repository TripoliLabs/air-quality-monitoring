import type { Sensor, SensorStatus } from '@aq/contracts';
import { type RelationalDb, sensors, type TelemetryDb } from '@aq/db';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, type SQL, sql } from 'drizzle-orm';
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
   * List all sensors. Can optionally filter by status or simulation flag in SQL.
   */
  async findAll(options?: {
    status?: SensorStatus;
    includeSimulated?: boolean;
  }): Promise<Sensor[]> {
    const conditions: SQL[] = [];
    if (options?.status) {
      conditions.push(eq(sensors.status, options.status));
    }
    if (options?.includeSimulated === false) {
      conditions.push(eq(sensors.isSimulated, false));
    }

    const baseQuery = this.relational.select().from(sensors);
    const rows =
      conditions.length > 0 ? await baseQuery.where(and(...conditions)) : await baseQuery;

    return rows.map(this.toSensorResponse);
  }

  /**
   * Return only the DevEUIs of active sensors (used by hot read paths like `/sensors/latest`).
   */
  async findActiveDeviceIds(): Promise<string[]> {
    const rows = await this.relational
      .select({ deviceId: sensors.deviceId })
      .from(sensors)
      .where(eq(sensors.status, 'active'));
    return rows.map((r) => r.deviceId);
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
      .onConflictDoNothing({ target: sensors.deviceId })
      .returning();

    if (!created) {
      throw new ConflictException(`Sensor with device ID ${normalized} is already registered`);
    }

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
    const registeredIds = registeredRows.map((r) => r.deviceId.toLowerCase());

    const excludeClause =
      registeredIds.length > 0
        ? sql`AND LOWER(sensor_id) NOT IN (${sql.join(
            registeredIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql``;

    const result = await this.telemetry.execute(sql`
      SELECT
        sensor_id AS "deviceId",
        MAX(bucket) AS "lastSeen",
        SUM(sample_count)::int AS "readingCount"
      FROM readings_hourly
      WHERE bucket >= NOW() - INTERVAL '7 days' ${excludeClause}
      GROUP BY sensor_id
      ORDER BY "lastSeen" DESC
      LIMIT 100
    `);

    const rows = result as unknown as Array<{
      deviceId: string;
      lastSeen: string | Date;
      readingCount: number;
    }>;

    return rows.map((r) => ({
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
      status: r.status,
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

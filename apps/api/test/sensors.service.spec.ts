import type { RelationalDb, TelemetryDb } from '@aq/db';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SensorsService } from '../src/sensors/sensors.service';

describe('SensorsService', () => {
  let service: SensorsService;
  let mockRelational: Partial<RelationalDb>;
  let mockTelemetry: Partial<TelemetryDb>;

  const sampleSensorRow = {
    id: '11111111-1111-1111-1111-111111111111',
    deviceId: '2cbcbbfffea945c4',
    name: 'Mina Port',
    description: 'Hardware test node',
    latitude: 34.455,
    longitude: 35.823,
    neighborhood: 'El Mina',
    status: 'active' as const,
    isActive: true,
    installedAt: new Date('2026-06-01T12:00:00Z'),
    isSimulated: false,
    lastSeenAt: null,
    batteryMv: 3950,
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-01T12:00:00Z'),
  };

  beforeEach(() => {
    mockRelational = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };
    mockTelemetry = {
      execute: vi.fn(),
    };
    service = new SensorsService(
      mockRelational as RelationalDb,
      mockTelemetry as TelemetryDb,
    );
  });

  describe('findByDeviceId', () => {
    it('returns formatted sensor when found', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([sampleSensorRow]),
      };
      (mockRelational.select as any).mockReturnValue(selectChain);

      const sensor = await service.findByDeviceId('2CBCBBFFFEA945C4');
      expect(sensor.deviceId).toBe('2cbcbbfffea945c4');
      expect(sensor.name).toBe('Mina Port');
      expect(sensor.status).toBe('active');
      expect(sensor.isSimulated).toBe(false);
    });

    it('throws NotFoundException when sensor is not found', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      (mockRelational.select as any).mockReturnValue(selectChain);

      await expect(service.findByDeviceId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and returns a new sensor', async () => {
      const existingCheck = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // no existing conflict
      };
      const insertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([sampleSensorRow]),
      };
      (mockRelational.select as any).mockReturnValue(existingCheck);
      (mockRelational.insert as any).mockReturnValue(insertChain);

      const result = await service.create({
        deviceId: '2CBCBBFFFEA945C4',
        name: 'Mina Port',
        latitude: 34.455,
        longitude: 35.823,
        neighborhood: 'El Mina',
        status: 'active',
        isSimulated: false,
      });

      expect(result.deviceId).toBe('2cbcbbfffea945c4');
      expect(mockRelational.insert).toHaveBeenCalled();
    });

    it('throws ConflictException if deviceId is already registered', async () => {
      const existingCheck = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
      };
      (mockRelational.select as any).mockReturnValue(existingCheck);

      await expect(
        service.create({
          deviceId: '2cbcbbfffea945c4',
          name: 'Duplicate Node',
          latitude: 34.4,
          longitude: 35.8,
          status: 'active',
          isSimulated: false,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('retire', () => {
    it('retires a sensor by setting status to retired and isActive to false', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([sampleSensorRow]),
      };
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          ...sampleSensorRow,
          status: 'retired',
          isActive: false,
        }]),
      };
      (mockRelational.select as any).mockReturnValue(selectChain);
      (mockRelational.update as any).mockReturnValue(updateChain);

      const retired = await service.retire('2cbcbbfffea945c4');
      expect(retired.status).toBe('retired');
      expect(retired.isActive).toBe(false);
    });
  });
});

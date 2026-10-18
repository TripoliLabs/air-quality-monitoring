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

  describe('findAll', () => {
    it('queries all sensors without where clause when no options are given', async () => {
      const selectChain = {
        from: vi.fn().mockResolvedValue([sampleSensorRow]),
      };
      (mockRelational.select as any).mockReturnValue(selectChain);

      const list = await service.findAll();
      expect(list).toHaveLength(1);
      expect(list[0].deviceId).toBe('2cbcbbfffea945c4');
    });

    it('applies SQL where clause when status or includeSimulated filter is provided', async () => {
      const whereMock = vi.fn().mockResolvedValue([sampleSensorRow]);
      const selectChain = {
        from: vi.fn().mockReturnValue({ where: whereMock }),
      };
      (mockRelational.select as any).mockReturnValue(selectChain);

      const list = await service.findAll({ status: 'active', includeSimulated: false });
      expect(whereMock).toHaveBeenCalledTimes(1);
      expect(list).toHaveLength(1);
    });
  });

  describe('findActiveDeviceIds', () => {
    it('selects only deviceId of active sensors', async () => {
      const whereMock = vi.fn().mockResolvedValue([{ deviceId: '2cbcbbfffea945c4' }]);
      const selectChain = {
        from: vi.fn().mockReturnValue({ where: whereMock }),
      };
      (mockRelational.select as any).mockReturnValue(selectChain);

      const ids = await service.findActiveDeviceIds();
      expect(whereMock).toHaveBeenCalledTimes(1);
      expect(ids).toEqual(['2cbcbbfffea945c4']);
    });
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
    it('creates and returns a new sensor atomically', async () => {
      const insertChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([sampleSensorRow]),
      };
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
      expect(insertChain.onConflictDoNothing).toHaveBeenCalled();
    });

    it('throws ConflictException if deviceId is already registered', async () => {
      const insertChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      (mockRelational.insert as any).mockReturnValue(insertChain);

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
        returning: vi.fn().mockResolvedValue([
          {
            ...sampleSensorRow,
            status: 'retired',
            isActive: false,
          },
        ]),
      };
      (mockRelational.select as any).mockReturnValue(selectChain);
      (mockRelational.update as any).mockReturnValue(updateChain);

      const retired = await service.retire('2cbcbbfffea945c4');
      expect(retired.status).toBe('retired');
      expect(retired.isActive).toBe(false);
    });
  });

  describe('findUnregistered', () => {
    it('excludes registered sensors in SQL and maps aggregate results', async () => {
      const selectChain = {
        from: vi.fn().mockResolvedValue([{ deviceId: '70b3d57ed0060001' }]),
      };
      (mockRelational.select as any).mockReturnValue(selectChain);
      (mockTelemetry.execute as any).mockResolvedValue([
        {
          deviceId: '2cbcbbfffea945c4',
          lastSeen: '2026-10-10T18:00:00.000Z',
          readingCount: 12,
        },
      ]);

      const unregistered = await service.findUnregistered();
      expect(unregistered).toEqual([
        {
          deviceId: '2cbcbbfffea945c4',
          lastSeen: '2026-10-10T18:00:00.000Z',
          readingCount: 12,
        },
      ]);
      expect(mockTelemetry.execute).toHaveBeenCalledTimes(1);
    });
  });
});

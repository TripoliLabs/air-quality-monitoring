import 'reflect-metadata';
import { ConfigurationStore } from '@aq/db';
import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationService } from '../src/sensors/configuration.service';
import type { SensorsService } from '../src/sensors/sensors.service';

describe('configuration service failure boundaries', () => {
  afterEach(() => vi.restoreAllMocks());
  function service(status = 'maintenance') {
    const findByDeviceId = vi.fn().mockResolvedValue({ deviceId: 'aaaaaaaa00000001', status });
    return {
      findByDeviceId,
      service: new ConfigurationService(
        { findByDeviceId } as unknown as SensorsService,
        {} as Redis,
      ),
    };
  }
  const command = { command: 'setInterval', seconds: 600 } as const;
  it('uses the registry-normalized ID for both reads and enqueue', async () => {
    const { service: api } = service();
    const state = { reported: null, outstanding: null, latestResult: null };
    const read = vi.spyOn(ConfigurationStore.prototype, 'state').mockResolvedValue(state);
    const write = vi
      .spyOn(ConfigurationStore.prototype, 'enqueue')
      .mockResolvedValue({ commandId: 'accepted', state });
    await api.get(' AAAAAAAA00000001 ');
    await api.enqueue(' AAAAAAAA00000001 ', command);
    expect(read).toHaveBeenCalledWith('aaaaaaaa00000001');
    expect(write).toHaveBeenCalledWith('aaaaaaaa00000001', command);
  });
  it('does not report acceptance when Redis fails', async () => {
    const { service: api } = service();
    vi.spyOn(ConfigurationStore.prototype, 'enqueue').mockRejectedValue(
      new Error('Redis lost connection'),
    );
    await expect(api.enqueue('aaaaaaaa00000001', command)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('surfaces state read failures instead of pretending state is absent', async () => {
    const { service: api } = service();
    vi.spyOn(ConfigurationStore.prototype, 'state').mockRejectedValue(new Error('Redis timeout'));
    await expect(api.get('aaaaaaaa00000001')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('rejects retired and unknown sensors before queue mutation', async () => {
    const { service: api, findByDeviceId } = service('retired');
    const enqueue = vi.spyOn(ConfigurationStore.prototype, 'enqueue');
    await expect(api.enqueue('aaaaaaaa00000001', command)).rejects.toBeInstanceOf(
      ConflictException,
    );
    findByDeviceId.mockRejectedValue(new NotFoundException());
    await expect(api.enqueue('aaaaaaaa00000002', command)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(enqueue).not.toHaveBeenCalled();
  });
});

import {
  type ConfigurationAccepted,
  type ConfigurationCommand,
  type ConfigurationState,
} from '@aq/contracts';
import { ConfigurationStore, configurationPolicy } from '@aq/db';
import { ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { SensorsService } from './sensors.service';

@Injectable()
export class ConfigurationService {
  private readonly store: ConfigurationStore;

  constructor(
    private readonly sensors: SensorsService,
    @Inject(REDIS) redis: Redis,
  ) {
    this.store = new ConfigurationStore(redis, configurationPolicy(process.env));
  }

  async get(deviceId: string): Promise<ConfigurationState> {
    const sensor = await this.sensors.findByDeviceId(deviceId);
    try {
      return await this.store.state(sensor.deviceId);
    } catch {
      throw new ServiceUnavailableException('Configuration state is unavailable');
    }
  }

  async enqueue(deviceId: string, command: ConfigurationCommand): Promise<ConfigurationAccepted> {
    const sensor = await this.sensors.findByDeviceId(deviceId);
    if (sensor.status === 'retired') throw new ConflictException('Sensor is retired');
    let accepted: Awaited<ReturnType<ConfigurationStore['enqueue']>>;
    try {
      accepted = await this.store.enqueue(sensor.deviceId, command);
    } catch {
      // A connection loss can hide a successful atomic enqueue. GET before retrying.
      throw new ServiceUnavailableException(
        'Enqueue could not be confirmed; read config state before retrying',
      );
    }
    if (!accepted) throw new ConflictException('Sensor already has an outstanding command');
    return { commandId: accepted.commandId, ...accepted.state };
  }
}

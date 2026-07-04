import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS = 'REDIS';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (c: ConfigService) =>
        new Redis(c.get<string>('REDIS_URL', 'redis://localhost:6379'), {
          maxRetriesPerRequest: null,
          // Fail a command (→ a fast API error) rather than hang forever if Redis is down.
          commandTimeout: 2000,
        }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}

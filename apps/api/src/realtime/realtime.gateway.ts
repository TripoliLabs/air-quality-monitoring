import type { AppEvent } from '@aq/contracts';
import { Inject, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import { REDIS } from '../redis/redis.module';

const READINGS_CHANNEL = 'readings';

/**
 * Bridges Redis Pub/Sub → Socket.IO. The ingestion service publishes a
 * `reading.created` event on the `readings` channel for every uplink; this
 * gateway relays them to all connected dashboard clients as `reading` events.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer() private server!: Server;
  private readonly sub: Redis;

  constructor(@Inject(REDIS) redis: Redis) {
    // A subscriber needs its own connection (can't issue normal commands once subscribed).
    this.sub = redis.duplicate();
  }

  onModuleInit(): void {
    this.sub.subscribe(READINGS_CHANNEL);
    this.sub.on('message', (_channel, message) => {
      try {
        const event = JSON.parse(message) as AppEvent;
        if (event.type === 'reading.created') {
          this.server.emit('reading', event.payload);
        }
      } catch {
        // ignore malformed messages
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.sub.quit();
  }
}

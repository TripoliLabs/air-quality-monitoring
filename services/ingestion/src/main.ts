import './tracing';
import 'reflect-metadata';
import { shutdownTelemetry } from '@aq/observability';
import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** Close Nest (runs onModuleDestroy → MQTT/Redis) then OTel, so we exit cleanly. */
function installGracefulShutdown(app: INestApplication): void {
  const shutdown = async (signal: string): Promise<void> => {
    Logger.log(`received ${signal}, shutting down`, 'Bootstrap');
    await app.close();
    await shutdownTelemetry();
    process.exit(0);
  };
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  installGracefulShutdown(app);
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Ingestion service listening on http://localhost:${port}`);
}

void bootstrap();

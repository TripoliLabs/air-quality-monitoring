import './tracing';
import 'reflect-metadata';
import { shutdownTelemetry } from '@aq/observability';
import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

/** Close Nest (runs onModuleDestroy) then OTel, so the process exits cleanly. */
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
      // Fail-safe: force exit if graceful close stalls (timer doesn't hold the loop).
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Security headers (CSP disabled so the Swagger UI assets load).
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });

  // Runtime request validation at the API boundary (ADR-002), via the Zod DTOs.
  app.useGlobalPipes(new ZodValidationPipe());

  // OpenAPI — schemas come straight from the Zod contracts via nestjs-zod.
  const config = new DocumentBuilder()
    .setTitle('Tripoli Air Quality API')
    .setDescription('Public REST API for the Tripoli air-quality monitoring network')
    .setVersion('1.0')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup('docs', app, document);

  installGracefulShutdown(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();

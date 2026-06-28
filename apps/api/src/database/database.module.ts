import { createRelationalDb, createTelemetryDb } from '@aq/db';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const RELATIONAL_DB = 'RELATIONAL_DB';
export const TELEMETRY_DB = 'TELEMETRY_DB';

function url(
  c: ConfigService,
  prefix: 'DB' | 'TSDB',
  fallbackHost: string,
  fallbackDb: string,
): string {
  const host = c.get<string>(`${prefix}_HOST`, fallbackHost);
  const port = c.get<string>(`${prefix}_PORT`, '5432');
  const user = c.get<string>(`${prefix}_USERNAME`, 'airquality');
  const pass = c.get<string>(`${prefix}_PASSWORD`, 'airquality');
  const name = c.get<string>(`${prefix}_NAME`, fallbackDb);
  return `postgres://${user}:${pass}@${host}:${port}/${name}`;
}

@Global()
@Module({
  providers: [
    {
      provide: RELATIONAL_DB,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => createRelationalDb(url(c, 'DB', 'postgres', 'airquality')),
    },
    {
      provide: TELEMETRY_DB,
      inject: [ConfigService],
      useFactory: (c: ConfigService) =>
        createTelemetryDb(url(c, 'TSDB', 'timescaledb', 'telemetry')),
    },
  ],
  exports: [RELATIONAL_DB, TELEMETRY_DB],
})
export class DatabaseModule {}

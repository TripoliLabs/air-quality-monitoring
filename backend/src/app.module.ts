/**
 * Root Application Module
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Feature modules
import { HealthModule } from './health/health.module';
// import { ApiModule } from './api/api.module';
// import { IngestionModule } from './ingestion/ingestion.module';
// import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database connection (TimescaleDB)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'airquality'),
        password: configService.get('DB_PASSWORD', 'airquality'),
        database: configService.get('DB_NAME', 'airquality'),
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') !== 'production',
      }),
    }),

    // Feature modules
    HealthModule,
    // ApiModule,
    // IngestionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';

@Module({
  controllers: [SensorsController, ConfigurationController],
  providers: [SensorsService, ConfigurationService],
  exports: [SensorsService],
})
export class SensorsModule {}

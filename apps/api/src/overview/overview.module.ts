import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';

@Module({ controllers: [OverviewController] })
export class OverviewModule {}

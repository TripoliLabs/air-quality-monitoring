import { Global, Module } from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard';

@Global()
@Module({
  providers: [AdminApiKeyGuard],
  exports: [AdminApiKeyGuard],
})
export class AuthModule {}

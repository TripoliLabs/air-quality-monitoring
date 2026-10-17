import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { AdminApiKeyGuard } from './admin-api-key.guard';

/**
 * Decorator to secure write/administrative endpoints with an API key.
 * Requires the X-API-Key header and documents the security requirement in OpenAPI.
 */
export function AdminOnly(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(AdminApiKeyGuard),
    ApiSecurity('admin-api-key'),
    ApiHeader({
      name: 'x-api-key',
      description: 'Admin API Key for authorized write operations',
      required: true,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' }),
  );
}

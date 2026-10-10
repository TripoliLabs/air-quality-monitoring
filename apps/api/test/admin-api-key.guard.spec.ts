import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminApiKeyGuard } from '../src/auth/admin-api-key.guard';

describe('AdminApiKeyGuard', () => {
  let guard: AdminApiKeyGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      ADMIN_API_KEY: 'correct-secret-key-12345',
    });
    guard = new AdminApiKeyGuard(configService);
  });

  function createMockContext(headers: Record<string, string>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access when valid X-API-Key is provided', () => {
    const ctx = createMockContext({ 'x-api-key': 'correct-secret-key-12345' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when valid Bearer token is provided', () => {
    const ctx = createMockContext({
      authorization: 'Bearer correct-secret-key-12345',
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException when key is missing', () => {
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when key is invalid', () => {
    const ctx = createMockContext({ 'x-api-key': 'wrong-key' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when server has no key configured', () => {
    const unconfiguredGuard = new AdminApiKeyGuard(new ConfigService({}));
    const ctx = createMockContext({ 'x-api-key': 'any-key' });
    expect(() => unconfiguredGuard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});

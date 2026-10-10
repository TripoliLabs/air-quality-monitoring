import crypto from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface HttpRequestWithHeaders {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HttpRequestWithHeaders>();
    const configuredKey = this.config.get<string>('ADMIN_API_KEY');

    if (!configuredKey) {
      throw new UnauthorizedException('Admin API key is not configured on the server');
    }

    const providedKey = this.extractApiKey(request);
    if (!providedKey) {
      throw new UnauthorizedException('Missing admin API key (provide via X-API-Key header)');
    }

    if (!this.timingSafeEqual(providedKey, configuredKey)) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }

  private extractApiKey(request: HttpRequestWithHeaders): string | null {
    const headerKey = request.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }

    const authHeader = request.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) return token;
    }

    return null;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }
}

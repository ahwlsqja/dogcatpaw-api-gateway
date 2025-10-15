// api-gateway/src/admin/guard/admin-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);
  private readonly adminKey: string | undefined;

  constructor(private configService: ConfigService) {
    this.adminKey = this.configService.get<string>('ADMIN_KEY');

    if (!this.adminKey) {
      this.logger.warn('ADMIN_KEY not configured in environment variables - admin endpoints will be protected by placeholder key');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const adminKeyFromHeader = request.headers['x-admin-key'] as string;

    // If ADMIN_KEY is not configured, deny all access
    if (!this.adminKey) {
      this.logger.error('Admin access denied - ADMIN_KEY not configured in environment');
      throw new UnauthorizedException('Admin endpoints not available - ADMIN_KEY not configured');
    }

    if (!adminKeyFromHeader) {
      this.logger.warn('Admin access attempt without admin key');
      throw new UnauthorizedException('Admin key required in X-Admin-Key header');
    }

    if (adminKeyFromHeader !== this.adminKey) {
      this.logger.warn(`Invalid admin key attempt from IP: ${request.ip}`);
      throw new UnauthorizedException('Invalid admin key');
    }

    this.logger.log(`Admin authenticated from IP: ${request.ip}`);
    return true;
  }
}

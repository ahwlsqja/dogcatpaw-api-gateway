// auth/guards/spring-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TokenService } from '../services/token.service';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Spring 서버 프록시용 Guard
 * - 게시물, 커뮤니티 플랫폼
 * - Redis 캐싱
 * - 리프레시 토큰
 * - 블록 토큰
 */
@Injectable()
export class SpringAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tokenService: TokenService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler());
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    // 1. 블록된 토큰 확인
    const isBlocked = await this.tokenService.isTokenBlocked(token);
    if (isBlocked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // 2. Middleware에서 주입한 user 확인
    if (!request.user) {
      throw new UnauthorizedException('Invalid token');
    }

    // 3. 캐시 확인 (이미 검증된 토큰?)
    const cached = await this.tokenService.getVerifiedToken(token);
    if (cached) {
      request.user = { ...request.user, ...cached };
      return true;
    }

    // 4. 새 토큰 → 캐시 저장
    await this.tokenService.setVerifiedToken(token, request.user.address, 3600);

    return true;
  }
}
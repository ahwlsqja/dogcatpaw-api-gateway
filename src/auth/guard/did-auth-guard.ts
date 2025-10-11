// auth/guards/did-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * DID 플랫폼용 Guard
 * - VC/VP 서버, 온체인 연동용
 * - 단순 서명 검증만
 * - 캐싱 불필요 (트랜잭션마다 검증)
 */
@Injectable()
export class DIDAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 개발 환경에서는 모든 요청 통과
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isDevelopment) {
      console.log('dev mode validate not it');
      return true;
    }

    const isPublic = this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler());
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // 1. Middleware에서 주입한 user 확인
    if (!request.user) {
      throw new UnauthorizedException('Missing authentication');
    }

    // 2. 주소 일치 확인
    const { address, walletAddress } = request.user;

    if (!walletAddress) {
      throw new UnauthorizedException('Missing wallet address header');
    }

    if (address !== walletAddress) {
      throw new UnauthorizedException('Wallet address mismatch');
    }

    return true;
  }
}
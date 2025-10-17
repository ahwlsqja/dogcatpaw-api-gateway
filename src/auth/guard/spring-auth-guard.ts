// auth/guards/spring-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TokenService } from '../services/token.service';
import { AuthService } from '../auth.service';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Spring 서버 프록시용 Guard
 * - 게시물, 커뮤니티 플랫폼
 * - Redis 캐싱
 * - 리프레시 토큰
 * - 블록 토큰
 * - VP 검증 (One Session = One VP)
 */
@Injectable()
export class SpringAuthGuard implements CanActivate {
  private readonly logger = new Logger(SpringAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private tokenService: TokenService,
    private authService: AuthService,
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

    // 3. VP 검증 (One Session = One VP) - with caching
    // VP verification IS the session verification
    const vpJwt = await this.tokenService.getVPForToken(token);

    if (vpJwt && vpJwt != "EMPTY") {
      try {
        // 3-1. 캐시된 검증 결과 확인 (빠름!) 
        const cachedVerification = await this.tokenService.getCachedVPVerification(token);

        if (cachedVerification && cachedVerification.verified) {
          // 즉시 반환 (블록체인 쿼리 생략)
          this.logger.debug(`VP cache hit for ${request.user.address} (verified at ${new Date(cachedVerification.verifiedAt).toISOString()})`);

          request.user = {
            ...request.user,
            vpVerified: true,
            vpHolder: cachedVerification.holder,
            vcCount: cachedVerification.vcCount,
          };

          return true;
        }

        // 3-2. Cache miss - Full verification 수행 (느림)
        this.logger.debug(`VP cache miss for ${request.user.address} - performing full verification`);

        const vpVerification = await this.authService.verifyPresentation(vpJwt);

        if (!vpVerification || !vpVerification.verified) {
          this.logger.warn(`VP 검증에 실패했습니다!: ${token.substring(0, 20)}...`);
          throw new UnauthorizedException('검증되지 않은 VP 에러 - Verification failed');
        }

        // Check if VP holder matches token address
        const vpHolder = vpVerification.holder?.replace('did:ethr:besu:', '');
        if (vpHolder?.toLowerCase() !== request.user.address?.toLowerCase()) {
          this.logger.warn(`VP holder mismatch: ${vpHolder} vs ${request.user.address}`);
          throw new UnauthorizedException('VP holder mismatch');
        }

        this.logger.log(`VP verified successfully for ${request.user.address}`);

        // 3-3. 검증 결과 캐싱 (다음 요청 최적화)
        await this.tokenService.cacheVPVerification(token, {
          verified: true,
          holder: vpVerification.holder,
          vcCount: vpVerification.verifiableCredential?.length || 0,
          verifiedAt: Date.now()
        }, 3600); // 1 hour TTL

        // Attach VP verification result to request
        request.user = {
          ...request.user,
          vpVerified: true,
          vpHolder: vpVerification.holder,
          vcCount: vpVerification.verifiableCredential?.length || 0,
        };
      } catch (error) {
        this.logger.error(`VP verification error: ${error.message}`);
        throw new UnauthorizedException(`VP verification error: ${error.message}`);
      }
    } else {
      this.logger.warn(`No VP found for token: ${token.substring(0, 20)}...`);
      // Optional: Allow access without VP or require VP
      // For now, we'll allow but mark as not VP-verified
      request.user = {
        ...request.user,
        vpVerified: false,
      };
    }

    return true;
  }
}
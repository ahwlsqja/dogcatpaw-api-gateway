// src/chat/adapter/ws-auth.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../../auth/services/token.service';
import { AuthService } from '../../auth/auth.service';

/**
 * WebSocket VP 인증 어댑터
 * - JWT 검증
 * - VP 검증 (캐시 활용)
 * - 블록된 토큰 확인
 */
export class WsAuthAdapter extends IoAdapter {
  private readonly logger = new Logger(WsAuthAdapter.name);
  private jwtService: JwtService;
  private tokenService: TokenService;
  private authService: AuthService;

  constructor(private app: INestApplicationContext) {
    super(app);
    this.jwtService = this.app.get(JwtService);
    this.tokenService = this.app.get(TokenService);
    this.authService = this.app.get(AuthService);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*', // 프로덕션에서는 특정 도메인으로 제한
        credentials: true,
      },
    });

    // WebSocket 연결 시 인증 미들웨어
    server.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          this.logger.warn('No token provided in WebSocket connection');
          return next(new Error('Authentication token missing'));
        }

        // 1. 블록된 토큰 확인
        const isBlocked = await this.tokenService.isTokenBlocked(token);
        if (isBlocked) {
          this.logger.warn(`Blocked token attempted WebSocket connection`);
          return next(new Error('Token has been revoked'));
        }

        // 2. JWT 검증
        let payload;
        try {
          payload = this.jwtService.verify(token);
        } catch (error) {
          this.logger.error(`JWT verification failed: ${error.message}`);
          return next(new Error('Invalid token'));
        }

        // 3. VP 검증 (캐시 우선)
        const vpJwt = await this.tokenService.getVPForToken(token);

        if (vpJwt && vpJwt !== 'EMPTY') {
          // 3-1. 캐시된 VP 검증 결과 확인
          const cachedVerification = await this.tokenService.getCachedVPVerification(token);

          if (cachedVerification && cachedVerification.verified) {
            this.logger.debug(`VP cache hit for WebSocket: ${payload.address}`);

            socket.data.user = {
              address: payload.address,
              isGuardian: payload.isGuardian,
              vpVerified: true,
              vpHolder: cachedVerification.holder,
              vcCount: cachedVerification.vcCount,
            };

            return next();
          }

          // 3-2. Cache miss - Full VP verification
          this.logger.debug(`VP cache miss for WebSocket: ${payload.address}`);

          try {
            const vpVerification = await this.authService.verifyPresentation(vpJwt);

            if (!vpVerification || !vpVerification.verified) {
              this.logger.warn(`VP verification failed for WebSocket`);
              return next(new Error('VP verification failed'));
            }

            // VP holder 매칭 확인
            const vpHolder = vpVerification.holder?.replace('did:ethr:besu:', '');
            if (vpHolder?.toLowerCase() !== payload.address?.toLowerCase()) {
              this.logger.warn(`VP holder mismatch: ${vpHolder} vs ${payload.address}`);
              return next(new Error('VP holder mismatch'));
            }

            this.logger.log(`VP verified successfully for WebSocket: ${payload.address}`);

            // 검증 결과 캐싱
            await this.tokenService.cacheVPVerification(
              token,
              {
                verified: true,
                holder: vpVerification.holder,
                vcCount: vpVerification.verifiableCredential?.length || 0,
                verifiedAt: Date.now(),
              },
              3600, // 1 hour
            );

            socket.data.user = {
              address: payload.address,
              isGuardian: payload.isGuardian,
              vpVerified: true,
              vpHolder: vpVerification.holder,
              vcCount: vpVerification.verifiableCredential?.length || 0,
            };

            return next();
          } catch (error) {
            this.logger.error(`VP verification error: ${error.message}`);
            return next(new Error(`VP verification error: ${error.message}`));
          }
        } else {
          // VP 없음 - 허용하되 미인증 상태로 표시
          this.logger.warn(`No VP found for WebSocket token`);

          socket.data.user = {
            address: payload.address,
            isGuardian: payload.isGuardian,
            vpVerified: false,
          };

          return next();
        }
      } catch (error) {
        this.logger.error(`WebSocket authentication error: ${error.message}`);
        return next(new Error('Authentication failed'));
      }
    });

    return server;
  }
}

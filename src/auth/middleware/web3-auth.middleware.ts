// auth/middleware/web3-auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import Web3Token from 'web3-token';

@Injectable()
export class Web3AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 개발 환경에서는 더미 사용자 데이터 주입
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isDevelopment) {
      // 개발용 테스트 지갑 주소
      const testAddress = req.headers.walletaddress as string || '0x1234567890123456789012345678901234567890';
      req.user = {
        address: testAddress.toLowerCase(),
        walletAddress: testAddress.toLowerCase(),
        tokenBody: {
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
        }
      };
      return next();
    }

    // 프로덕션 환경에서는 실제 인증 수행
    const authHeader = req.headers.authorization as string;
    const walletAddress = req.headers.walletaddress as string;

    if (!authHeader) {
      return next();
    }

    // Extract token (remove 'Bearer ' prefix if present)
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    try {
      // First try JWT verification (for login flow)
      try {
        const payload = this.jwtService.verify(token);

        // JWT verified - set user from JWT payload
        req.user = {
          address: payload.address.toLowerCase(),
          walletAddress: payload.address.toLowerCase(),
          isGuardian: payload.isGuardian,
          vcCount: payload.vcCount,
          tokenBody: {
            iat: payload.iat,
            exp: payload.exp
          }
        };

        return next();
      } catch (jwtError) {
        // JWT verification failed, try Web3Token as fallback
      }

      // Fallback to Web3Token verification
      const { address, body } = await Web3Token.verify(token);

      // Request에 주입
      req.user = {
        address: address.toLowerCase(),
        walletAddress: walletAddress?.toLowerCase(),
        tokenBody: body
      };

      next();
    } catch (error) {
      // 실패해도 통과 (Guard에서 처리)
      next();
    }
  }
}
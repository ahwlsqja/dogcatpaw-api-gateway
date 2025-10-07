// auth/middleware/web3-auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Web3Token from 'web3-token';

@Injectable()
export class Web3AuthMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization as string;
    const walletAddress = req.headers.walletaddress as string;

    if (!token) {
      return next();
    }

    try {
      // Web3Token 검증만
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
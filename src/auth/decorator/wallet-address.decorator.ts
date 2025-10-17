import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

/**
 * 지갑 주소 추출 데코레이터
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(DIDAuthGuard)
 * async getProfile(@WalletAddress() address: string) {
 *   // address 사용
 * }
 * ```
 */
export const WalletAddress = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const address = request.user?.address;

    if (!address) {
      throw new UnauthorizedException('Wallet address not found in request');
    }

    return address;
  },
);

/**
 * 지갑 주소 추출 데코레이터 (Optional)
 * 지갑 주소가 없어도 에러를 발생시키지 않음
 *
 * @example
 * ```typescript
 * @Get('public-endpoint')
 * async publicEndpoint(@WalletAddressOptional() address?: string) {
 *   if (address) {
 *     // 로그인한 사용자 처리
 *   } else {
 *     // 비로그인 사용자 처리
 *   }
 * }
 * ```
 */
export const WalletAddressOptional = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user?.address;
  },
);

/**
 * 전체 User 객체 추출 데코레이터
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(SpringAuthGuard)
 * async getProfile(@CurrentUser() user: any) {
 *   // user.address, user.isGuardian, user.vpVerified 등 사용
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);

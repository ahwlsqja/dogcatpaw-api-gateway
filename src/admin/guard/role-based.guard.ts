import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from 'src/common/enums/role.enum';

/**
 * Admin Role-Based Access Control Guard
 *
 * JWT 토큰에서 role을 확인하여 ADMIN만 접근을 허용하는 가드
 * admin-auth.guard.ts와는 별개로 role 기반 접근 제어를 수행
 */
@Injectable()
export class RoleBasedGuard implements CanActivate {
  private readonly logger = new Logger(RoleBasedGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('No Bearer token found in Authorization header');
      throw new UnauthorizedException('인증 토큰이 필요합니다');
    }

    const token = authHeader.substring(7);

    try {
      // JWT 토큰 검증 및 디코딩
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret: jwtSecret });

      this.logger.debug(`Token verified for address: ${payload.address}, role: ${payload.role}`);

      // Role 확인
      if (payload.role === undefined || payload.role === null) {
        this.logger.warn(`No role found in token for address: ${payload.address}`);
        throw new ForbiddenException('권한 정보가 없습니다');
      }

      // ADMIN 권한 검증
      if (payload.role !== Role.ADMIN) {
        this.logger.warn(`Access denied for non-admin user: ${payload.address}, role: ${payload.role}`);
        throw new ForbiddenException('관리자 권한이 필요합니다');
      }

      // Request 객체에 사용자 정보 추가
      request.user = {
        address: payload.address,
        role: payload.role,
        isGuardian: payload.isGuardian,
        vcCount: payload.vcCount,
      };

      this.logger.log(`✅ Admin access granted: ${payload.address}`);
      return true;

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`JWT verification failed: ${error.message}`);
      throw new UnauthorizedException('유효하지 않은 토큰입니다');
    }
  }
}

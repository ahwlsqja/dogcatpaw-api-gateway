import { Controller, Post, Body, Get, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { VcProxyService } from '../vc/vc.proxy.service';
import { DIDAuthGuard } from './guard/did-auth-guard';
import { VCDto } from 'src/vc/dto/grpc-vc-req.dto';
import { Public } from './decorator/public.decorator';
import { TokenService } from './services/token.service';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly vcProxyService: VcProxyService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Step 1: Challenge 요청 (로그인 시작)
   * API Gateway 인증을 위한 challenge-response 방식
   */
  @Public()
  @Post('challenge')
  @ApiOperation({ summary: '로그인하기 위한 서명' })
  async getChallenge(@Body() dto: { walletAddress: string }) {
    const challenge = await this.authService.createChallenge(dto.walletAddress);

    return {
      success: true,
      challenge,
      message: 'Sign this challenge with your wallet',
      expiresIn: 300, // 5 minutes
    };
  }

  /**
   * Step 2: 서명 검증 및 로그인 (API Gateway 인증)
   * API Gateway 세션 생성 + VP 자동 생성 (One Session = One VP)
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with wallet signature and auto-create VP' })
  async login(
    @Body() dto: {
      walletAddress: string;
      signature: string;
      challenge: string;
    }
  ) {
    try {
      // 1. 지갑 서명 검증
      const isValid = await this.authService.verifySignature(
        dto.walletAddress,
        dto.challenge,
        dto.signature
      );

      if (!isValid) {
        throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
      }

      // 2. 가디언 정보 가져오기 async로
      const guardianInfo = await this.vcProxyService.getGuardianInfo({
        walletAddress: dto.walletAddress
      }).catch(() => null);

      // 3. 모든 VC에 대한 하나의 VP 생성
      const vcsResponse = await this.vcProxyService.getVCsByWallet({
        walletAddress: dto.walletAddress
      }).catch(() => ({ vcs: [] }));
      const vcs = vcsResponse.vcs || [];

      // 4. API GateWay를 위한 접근 Access Token 발급
      const accessToken = await this.authService.createAccessToken({
        address: dto.walletAddress,
        isGuardian: !!guardianInfo,
        vcCount: vcs.length,
      });

      // 5. VP 생성 (서버사이드 - 이미 서명된 challenge 재사용)
      // VP 조립
      const vpSigningData = this.authService.prepareVPSigning({
        holder: dto.walletAddress,
        verifiableCredentials: vcs.map((vc: any) => vc.vcJwt),
        audience: process.env.SPRING_SERVER_URL || 'http://localhost:8080',
        purpose: 'authentication',
      });

      // VP 생성
      const vp = await this.authService.createVPWithSignature({
        holder: dto.walletAddress,
        signature: dto.signature,
        message: vpSigningData.message,
        verifiableCredentials: vcs.map((vc: any) => vc.vcJwt),
      });

      // 6. VP 세션 Redis에 저장
      await this.tokenService.setVPForToken(accessToken, vp.jwt, 86400); // 24 hours

      // 7. API GateWay를 위한 접근 Refresh Token 발급
      const refreshToken = await this.authService.createRefreshToken(dto.walletAddress);

      return {
        success: true,
        accessToken,
        refreshToken,
        vpJwt: vp.jwt, // VP included in login response
        profile: {
          walletAddress: dto.walletAddress,
          guardianInfo,
          vcCount: vcs.length,
        },
        message: '로그인이 성공했습니다!!',
      };
    } catch (error) {
      throw new HttpException(
        error.message || '로그인 실패',
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * 사용자 프로필 조회 (로그인 후)
   */
  @Get('profile')
  @UseGuards(DIDAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile with VCs' })
  async getProfile(@Req() req: Request) {
    const walletAddress = req.user?.address;

    // Get guardian info
    const guardianInfo = await this.vcProxyService.getGuardianInfo({
      walletAddress
    }).catch(() => null);

    // Get all VCs
    /**
      petDID,
      vcJwt,
      vcType,
      createdAt,
     */
    const response = await this.vcProxyService.getVCsByWallet({
      walletAddress
    }).catch(() => ({ vcs: [] }));
    const vcs = response.vcs || [];

    // Get pets
    const petVCs = vcs.filter((vc: VCDto) => vc.vcType === 'PetOwnership');

    return {
      success: true,
      profile: {
        did: `did:ethr:besu:${walletAddress}`,
        walletAddress,
        isGuardian: !!guardianInfo,
        guardianInfo,
        credentials: {
          total: vcs.length,
          pets: petVCs.length,
          identity: vcs.filter((vc: any) => vc.vcType === 'IdentityCard').length,
        },
        pets: petVCs.map((vc: any) => ({
          petDID: vc.credentialSubject?.petDID,
          name: vc.credentialSubject?.name,
          species: vc.credentialSubject?.species,
          issuedAt: vc.issuanceDate,
        })),
      },
    };
  }

  /**
   * Logout current session (revoke current token + VP)
   */
  @Post('logout')
  @UseGuards(DIDAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session (1 session)' })
  async logout(@Req() req: Request) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      // Revoke current session (token + VP)
      await this.tokenService.blockToken(token);
      await this.tokenService.deleteVPForToken(token);
    }

    return {
      success: true,
      message: 'Current session logged out successfully',
    };
  }

  /**
   * Logout all sessions for this address (revoke all tokens + VPs)
   */
  @Post('logout-all')
  @UseGuards(DIDAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all sessions (entire logout)' })
  async logoutAll(@Req() req: Request) {
    const walletAddress = req.user?.address;

    // Revoke all sessions for this address
    await this.tokenService.blockAllTokensByAddress(walletAddress);

    return {
      success: true,
      message: 'All sessions logged out successfully',
    };
  }
}
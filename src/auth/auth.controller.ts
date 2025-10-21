import { Controller, Post, Body, Get, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { VcProxyService } from '../vc/vc.proxy.service';
import { DIDAuthGuard } from './guard/did-auth-guard';
import { VCDto } from 'src/vc/dto/grpc-vc-req.dto';
import { Public } from './decorator/public.decorator';
import { TokenService } from './services/token.service';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { SpringProxyService } from 'src/spring/spring.proxy.service';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly vcProxyService: VcProxyService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Step 1: Challenge 요청 (로그인 시작)
   * API Gateway 인증을 위한 challenge-response 방식
   * VP 서명 데이터도 함께 반환
   */
  @Post('challenge')
  @ApiOperation({ summary: '로그인하기 위한 서명 (challenge + VP signing data)' })
  async getChallenge(@Body() dto: { walletAddress: string }) {
    const challenge = await this.authService.createChallenge(dto.walletAddress);

    // VCs 가져오기 (VP 생성용)
    const vcsResponse = await this.vcProxyService.getVCsByWallet({
      walletAddress: dto.walletAddress
    }).catch(() => ({ vcs: [] }));
    const vcs = vcsResponse.vcs || [];

    // VC가 없으면 VP 서명 데이터 없이 반환
    if (vcs.length === 0) {
      return {
        success: true,
        challenge,
        vpSigningData: null,
        message: 'Sign this challenge with your wallet (no VCs found, VP will not be created)',
        expiresIn: 300, // 5 minutes
      };
    }

    // VP 서명 데이터 준비
    const vpSigningData = this.authService.prepareVPSigning({
      holder: dto.walletAddress,
      verifiableCredentials: vcs.map((vc: any) => vc.vcJwt),
      audience: this.configService.get<string>(envVariableKeys.springurl) || 'http://localhost:8080',
      purpose: 'authentication',
    });

    return {
      success: true,
      challenge,
      vpSigningData, // VP 서명 데이터 추가
      message: 'Sign both challenge and VP message with your wallet',
      expiresIn: 300, // 5 minutes
    };
  }

  /**
   * Step 2: 서명 검증 및 로그인 (API Gateway 인증)
   * API Gateway 세션 생성 + VP 생성 (vpSignature 필요)
   */
  @Post('login')
  @ApiOperation({ summary: 'Login with wallet signature and VP signature' })
  async login(
    @Body() dto: {
      walletAddress: string;
      signature: string;
      challenge: string;
      vpSignature?: string;
      vpMessage?: any;
      vpSignedData?: string;
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

      // 2. 가디언 정보 가져오기 async로 (VC Service 사용 가능 시)
      const guardianInfo = await this.vcProxyService.getGuardianInfo({
        walletAddress: dto.walletAddress
      }).catch((error) => {
        // VC Service 에러 시 null 반환 (로그인은 계속 진행)
        console.log('Guardian info fetch failed, continuing without guardian data:', error.message);
        return null;
      });

      // VC Service 에러 체크: 실제 서비스 에러인 경우만 예외 발생
      // '가디언정보등록X'는 정상 케이스 (아직 등록하지 않은 사용자)
      if(guardianInfo && guardianInfo.error && guardianInfo.error !== '가디언정보등록X') {
        throw new Error(`Server Error: VC Service 에러 - ${guardianInfo.error}`)
      }

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

      // VC가 없거나 VP 서명이 없는 경우
      if(vcs.length === 0 || !dto.vpSignature || !dto.vpMessage) {
        const refreshToken = await this.authService.createRefreshToken(dto.walletAddress);

        await this.tokenService.setVPForToken(accessToken, "EMPTY", 86400); // 24 hours

        return {
        success: true,
        accessToken,
        refreshToken,
        vpJwt: "EMPTY",
        profile: {
          walletAddress: dto.walletAddress,
          guardianInfo,
          vcCount: vcs.length,
        },
        message: '로그인이 성공했습니다!! (No VP created)',
      };
      }

      // 5. VP 생성 (클라이언트가 서명한 VP 메시지 사용)
      const vp = await this.authService.createVPWithSignature({
        holder: dto.walletAddress,
        signature: dto.vpSignature, // VP 전용 서명 사용
        message: dto.vpMessage,
        verifiableCredentials: vcs.map((vc: any) => vc.vcJwt),
        signedData: dto.vpSignedData, // 클라이언트가 서명한 정확한 데이터
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
      // Revoke current session (token + VP + VP verification cache)
      await this.tokenService.blockToken(token);
      await this.tokenService.deleteVPForToken(token);
      await this.tokenService.deleteCachedVPVerification(token); // 캐시도 삭제
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
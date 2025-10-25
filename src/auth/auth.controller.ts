import { Controller, Post, Body, Get, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
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
import { VCErrorCode } from 'src/common/const/vc-error-codes';
import { ChallengeRequestDto, ChallengeResponseDto } from './dto/challenge.dto';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { ProfileResponseDto, LogoutResponseDto } from './dto/profile.dto';

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
  @ApiOperation({
    summary: 'Step 1: Get Challenge for Wallet Signature',
    description: `
**DID-based Authentication Flow - Step 1**

Request a challenge message to sign with your wallet. This endpoint also returns VP (Verifiable Presentation) signing data if the user has any Verifiable Credentials.

**CRITICAL: Wallet Address Format**
- ⚠️ Wallet address MUST be lowercase
- ❌ WRONG: "0xE9ebc691cCFB15Cb4bf31Af83c624b7020f0d2C0"
- ✅ CORRECT: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0"

**Flow:**
1. Send wallet address (lowercase)
2. Receive challenge string + VP signing data (if VCs exist)
3. Sign both:
   - Challenge with wallet.signMessage(challenge)
   - VP messageHash with wallet.signMessage(messageHash)
4. Submit signatures to /api/auth/login

**Challenge Expiration:** 5 minutes (300 seconds)
    `,
  })
  @ApiBody({ type: ChallengeRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Challenge and VP signing data successfully generated',
    type: ChallengeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid wallet address format',
  })
  async getChallenge(@Body() dto: ChallengeRequestDto) {
    const challenge = await this.authService.createChallenge(dto.walletAddress);

    // VCs 가져오기 (VP 생성용)
    const vcsResponse = await this.vcProxyService.getVCsByWallet({
      walletAddress: dto.walletAddress
    }).catch(() => ({ success: false, data: { vcs: [] } }));
    const vcs = vcsResponse.data?.vcs || [];

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
  @ApiOperation({
    summary: 'Step 2: Login with Wallet Signature and VP',
    description: `
**DID-based Authentication Flow - Step 2**

Verify wallet signature and create authenticated session. If user has VCs, also verifies VP signature and creates VP JWT.

**CRITICAL: Wallet Address Format**
- ⚠️ Wallet address MUST be lowercase
- Backend normalizes all addresses to lowercase for comparison
- Mixed-case addresses will result in "wallet not found" error

**Request Flow:**
1. Submit signed challenge from Step 1
2. Submit VP signature (if you received vpSigningData in Step 1)
3. Receive access token + refresh token + VP JWT
4. Store tokens securely (localStorage or httpOnly cookies)

**Authentication:**
- Access Token: Use in Authorization header for API calls
- Refresh Token: Use to obtain new access token when expired
- VP JWT: Verifiable Presentation (EMPTY if no VCs)

**Success Response:**
- accessToken: JWT for API authentication
- refreshToken: Token to refresh session
- vpJwt: Verifiable Presentation JWT
- profile: User profile including guardian info and VC count

**Next Steps:**
- Store tokens securely
- Use accessToken in Authorization: Bearer {token} header
- Check profile.guardianInfo to determine if guardian registration needed
    `,
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful - tokens and profile returned',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid signature or challenge expired',
  })
  async login(@Body() dto: LoginRequestDto) {
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
      const guardianInfoResponse = await this.vcProxyService.getGuardianInfo({
        walletAddress: dto.walletAddress
      }).catch((error) => {
        // VC Service 에러 시 null 반환 (로그인은 계속 진행)
        console.log('Guardian info fetch failed, continuing without guardian data:', error.message);
        return null;
      });

      // VC Service 에러 체크 및 데이터 추출
      // GUARDIAN_NOT_FOUND는 정상 케이스 (아직 등록하지 않은 사용자)
      let guardianInfo = null;
      if (guardianInfoResponse) {
        if (!guardianInfoResponse.success) {
          // 에러 응답인 경우
          if (guardianInfoResponse.errorCode === VCErrorCode.GUARDIAN_NOT_FOUND) {
            // GUARDIAN_NOT_FOUND - 정상 케이스
            console.log('Guardian not registered yet');
            guardianInfo = null;
          } else {
            // 다른 에러 - 예외 발생
            throw new Error(
              `Server Error: VC Service 에러 - ${guardianInfoResponse.errorCode}: ${guardianInfoResponse.errorMessage}`
            );
          }
        } else {
          // 성공 응답인 경우 data 추출
          guardianInfo = guardianInfoResponse.data || null;
        }
      }

      // 3. 모든 VC에 대한 하나의 VP 생성
      const vcsResponse = await this.vcProxyService.getVCsByWallet({
        walletAddress: dto.walletAddress
      }).catch(() => ({ success: false, data: { vcs: [] } }));
      const vcs = vcsResponse.data?.vcs || [];

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
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get User Profile',
    description: `
**Get Authenticated User Profile**

Retrieve complete user profile including:
- DID and wallet address
- Guardian registration status and info
- Verifiable Credentials count (total, pets, identity)
- List of owned pets with VC data

**Authentication Required:**
- Include access token in Authorization header
- Format: "Authorization: Bearer {accessToken}"

**Profile Information:**
- did: Decentralized Identifier
- walletAddress: Ethereum wallet address
- isGuardian: Whether user is registered as guardian
- guardianInfo: Guardian details (null if not registered)
- credentials: VC statistics breakdown
- pets: Array of owned pets with VC info

**Use Cases:**
- Check guardian registration status
- Display user dashboard
- Show owned pets list
- Verify VC ownership
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Profile successfully retrieved',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async getProfile(@Req() req: Request) {
    const walletAddress = req.user?.address;

    // Get guardian info
    const guardianInfoResponse = await this.vcProxyService.getGuardianInfo({
      walletAddress
    }).catch(() => null);

    // Extract data from VCResponse format
    const guardianInfo = guardianInfoResponse?.success && guardianInfoResponse.data
      ? guardianInfoResponse.data
      : null;

    console.log(guardianInfo)

    // Get all VCs
    /**
      petDID,
      vcJwt,
      vcType,
      createdAt,
     */
    const response = await this.vcProxyService.getVCsByWallet({
      walletAddress
    }).catch(() => ({ success: false, data: { vcs: [] } }));
    const vcs = response.data?.vcs || [];

    // Get pets
    const petVCs = vcs.filter((vc: VCDto) => vc.vcType === 'GuardianIssuedPetVC');

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
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout Current Session',
    description: `
**Logout from Current Device/Session**

Revoke the current access token and associated VP. This only logs out the current session.

**What Happens:**
- Current access token is blocked and cannot be reused
- Associated VP JWT is deleted
- VP verification cache is cleared
- Other sessions on different devices remain active

**Authentication Required:**
- Include current access token in Authorization header
- Format: "Authorization: Bearer {accessToken}"

**Use Cases:**
- User logs out from current device
- Switch accounts on same device
- Security: Revoke compromised session

**Note:**
- To logout from all devices, use POST /api/auth/logout-all
- Tokens cannot be reused after logout
- User must login again to get new tokens
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Current session logged out successfully',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout All Sessions',
    description: `
**Logout from All Devices/Sessions**

Revoke ALL access tokens and VPs for this wallet address. This logs out all sessions on all devices.

**What Happens:**
- ALL access tokens for this wallet are blocked
- ALL associated VPs are deleted
- User is logged out from all devices (mobile, desktop, tablet, etc.)
- All active sessions are terminated

**Authentication Required:**
- Include access token in Authorization header
- Format: "Authorization: Bearer {accessToken}"

**Use Cases:**
- Security: Suspect account compromise
- User wants fresh start on all devices
- Lost device - revoke all sessions remotely
- Change wallet password/keys

**Important:**
- This is irreversible - all active sessions will be terminated
- User must login again on ALL devices
- Cannot recover previous sessions
- Use with caution

**Note:**
- For single device logout, use POST /api/auth/logout
- Recommended after security incidents
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'All sessions logged out successfully',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
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
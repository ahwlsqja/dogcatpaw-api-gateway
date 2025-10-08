import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { GuardianService } from './guardian.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ethers } from 'ethers';

@ApiTags('Guardian')
@ApiBearerAuth()
@Controller('api/guardian')
export class GuardianController {
  constructor(
    private readonly guardianService: GuardianService,
    private readonly vcProxyService: VcProxyService,
  ) {}

  /**
   * 보호자 등록 (이메일 인증 완료 후)
   */
  @Post('register')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '보호자 등록 - 이메일 인증 완료 후' })
  async registerGuardian(
    @Req() req: Request,
    @Body() dto: CreateGuardianDto
  ) {
    const guardianAddress = req.user?.address;

    // 1. VC Service에 Auth 확인
    const authCheck = await this.vcProxyService.checkAuth({
      walletAddress: guardianAddress
    });

    if (!authCheck || !authCheck.isAuthenticated) {
      return {
        success: false,
        error: 'Email verification required. Please verify your email first.'
      };
    }

    // 2. 블록체인에 보호자 등록
    const personalDataHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        email: dto.email || authCheck.email || '',
        phone: dto.phone || '',
        name: dto.name || '',
        timestamp: Date.now()
      }))
    );

    const txResult = await this.guardianService.registerGuardian(
      guardianAddress,
      personalDataHash,
      '0', // NCP 저장 안함
      dto.verificationMethod || 2, // 2: Email verified
      dto.signedTx
    );

    // 3. 트랜잭션 성공 후 VC Service에 Guardian 정보 저장
    if (txResult.success) {
      const vcResult = await this.vcProxyService.updateGuardianInfo({
        walletAddress: guardianAddress,
        email: dto.email || authCheck.email,
        phone: dto.phone,
        name: dto.name,
        isEmailVerified: true
      });

      return {
        success: true,
        guardianId: vcResult.guardianId,
        txHash: txResult.txHash,
        message: 'Guardian registered',
      };
    }

    return txResult;
  }

  /**
   * 관리자가 보호자 검증
   */
  @Post('verify/:guardianAddress')
  @UseGuards(DIDAuthGuard) // TODO: AdminGuard로 변경 필요
  @ApiOperation({ summary: '보호자 검증 (관리자 전용)' })
  async verifyGuardian(@Param('guardianAddress') guardianAddress: string) {
    const tx = await this.guardianService.verifyGuardian(
      guardianAddress,
      false, // smsVerified
      true   // emailVerified (이메일 인증은 이미 완료됨)
    );

    return {
      success: true,
      txHash: tx.txHash,
    };
  }

  @Post('link-pet')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '펫 연결' })
  async linkPet(
    @Req() req: Request,
    @Body() dto: { petDID: string; signedTx?: string }
  ) {
    const walletAddress = req.user?.address;
    return this.guardianService.linkPet(walletAddress, dto.petDID, dto.signedTx);
  }

  @Post('unlink-pet')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '펫 연결 해제' })
  async unlinkPet(
    @Req() req: Request,
    @Body() dto: { petDID: string; signedTx?: string }
  ) {
    const walletAddress = req.user?.address;
    return this.guardianService.unlinkPet(walletAddress, dto.petDID, dto.signedTx);
  }

  @Get('profile/:address')
  @ApiOperation({ summary: '보호자 프로필 조회' })
  async getProfile(@Param('address') guardianAddress: string) {
    return this.guardianService.getGuardianProfile(guardianAddress);
  }

  @Get('pets/:address')
  @ApiOperation({ summary: '보호자 펫 목록 조회' })
  async getPets(@Param('address') guardianAddress: string) {
    return this.guardianService.getGuardianPets(guardianAddress);
  }

  @Get('verification/:address')
  @ApiOperation({ summary: '보호자 검증 상태 조회' })
  async getVerification(@Param('address') guardianAddress: string) {
    return this.guardianService.getVerificationProof(guardianAddress);
  }

  @Get('total')
  @ApiOperation({ summary: '전체 보호자 수 조회' })
  async getTotalGuardians() {
    return { total: await this.guardianService.getTotalGuardians() };
  }

  @Get('check/:address')
  @ApiOperation({ summary: '보호자 등록 여부 확인' })
  async checkRegistration(@Param('address') guardianAddress: string) {
    return {
      isRegistered: await this.guardianService.isGuardianRegistered(guardianAddress)
    };
  }
}

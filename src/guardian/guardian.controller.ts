import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { GuardianService } from './guardian.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { SpringService } from 'src/spring/spring.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ethers } from 'ethers';

@ApiTags('Guardian')
@ApiBearerAuth()
@Controller('api/guardian')
export class GuardianController {
  constructor(
    private readonly guardianService: GuardianService,
    private readonly vcProxyService: VcProxyService,
    private readonly springService: SpringService,
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

    // 1. VC Service에 Auth 확인 (이메일 인증 여부 확인)
    let authCheck;
    authCheck = await this.vcProxyService.checkAuth({
      walletAddress: guardianAddress
    });

    // checkAuth returns: { success: boolean, authId: number, message: string, error?: string }
    if (!authCheck || !authCheck.success) {
      return {
        success: false,
        error: '이메일 인증이 필요합니다! 먼저 인증해주세요!'
      };
    }
    
    // 2. 이메일 필수 검증
    if (!dto.email) {
      return {
        success: false,
        error: '이메일은 필수 항목입니다'
      };
    }

    // 3. 블록체인에 보호자 등록
    const personalDataHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        email: dto.email,
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

    // 4. 트랜잭션 성공 후 VC Service에 Guardian 정보 저장
    if (txResult.success) {
      const vcResult = await this.vcProxyService.updateGuardianInfo({
        walletAddress: guardianAddress,
        email: dto.email,
        phone: dto.phone,
        name: dto.name,
        isEmailVerified: true,
        isOnChainRegistered: true,
      });

      // 5. 스프링에서는 불큐 처리 즉시성 필요 X
      const springJobId = await this.springService.queueUserSync(
        guardianAddress,
        'register',
        {
          email: dto.email,
          phone: dto.phone,
          name: dto.name,
          guardianId: vcResult.guardianId,
        }
      );
      console.log(`📝 Queued Spring sync - Job ID: ${springJobId}`);

      return {
        success: true,
        guardianId: vcResult.guardianId,
        authId: authCheck.authId,
        txHash: txResult.txHash,
        springJobId,
        message: 'Guardian registered successfully. Spring sync queued.',
      };
    }

    return txResult;
  }
}

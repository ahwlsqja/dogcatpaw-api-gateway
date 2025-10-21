import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { GuardianService } from './guardian.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { VcQueueService } from 'src/vc/vc-queue.service';
import { SpringService } from 'src/spring/spring.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ethers } from 'ethers';
import { Role } from 'src/common/enums/role.enum';

@ApiTags('Guardian')
@ApiBearerAuth()
@Controller('api/guardian')
export class GuardianController {
  constructor(
    private readonly guardianService: GuardianService,
    private readonly vcProxyService: VcProxyService,
    private readonly vcQueueService: VcQueueService,
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

    // 3. 블록체인에 이미 등록되어 있는지 확인
    const isAlreadyRegistered = await this.guardianService.isGuardianRegistered(guardianAddress);
    if (isAlreadyRegistered) {
      return {
        success: false,
        error: '이미 블록체인에 등록된 주소입니다. 중복 등록은 불가능합니다.',
        alreadyRegistered: true
      };
    }

    // 4. 블록체인에 보호자 등록
    const personalDataHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        email: dto.email,
        phone: dto.phone || '',
        name: dto.name || '',
        timestamp: Date.now()
      }))
    );

    // Production mode logging
    if (process.env.NODE_ENV === 'production' && dto.signedTx) {
      console.log(`Production mode: Received signedTx (${dto.signedTx?.length} chars): ${dto.signedTx?.substring(0, 50)}...`);
    }

    const txResult = await this.guardianService.registerGuardian(
      guardianAddress,
      personalDataHash,
      '0', // NCP 저장 안함
      dto.verificationMethod || 2, // 2: Email verified
      dto.signedTx
    );

    // 5. 트랜잭션 성공 후 즉시 응답 반환 + 백그라운드에서 VC/Spring 동기화
    if (txResult.success) {
      // 🚀 Queue VC sync (fire & forget)
      const vcJobId = await this.vcQueueService.queueGuardianSync(
        guardianAddress,
        dto.email,
        dto.phone,
        dto.name,
      );
      console.log(`📝 Queued VC sync - Job ID: ${vcJobId}`);

      if(dto.role === Role.USER){
        // 🚀 Queue Spring sync (fire & forget)
        const springJobId = await this.springService.queueUserRegister(
          guardianAddress,
          {
            email: dto.email,
            phone: dto.phone,
            name: dto.name,
            gender: dto.gender,
            old: dto.old,
            address: dto.address,
          }
        );
        console.log(`📝 Queued Spring registration - Job ID: ${springJobId}`);

              // 즉시 프론트로 응답 반환
        return {
          success: true,
          authId: authCheck.authId,
          txHash: txResult.txHash,
          blockNumber: txResult.blockNumber,
          vcJobId,
          springJobId,
          message: 'Guardian registered on blockchain. Syncing data in background.',
        };
      } else {
        // 🚀 Queue Spring sync (fire & forget)
        const springJobId = await this.springService.queueAdminRegister(
          guardianAddress,
          {
            email: dto.email,
            phone: dto.phone,
            name: dto.name,
            gender: dto.gender,
            old: dto.old,
            address: dto.address,
          }
        );
      console.log(`📝 Queued Spring registration - Job ID: ${springJobId}`);

            // 즉시 프론트로 응답 반환
      return {
        success: true,
        authId: authCheck.authId,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        vcJobId,
        springJobId,
        message: 'Guardian registered on blockchain. Syncing data in background.',
      };
      }
    }

    return txResult;
  }

  /**
   * Guardian Link Pet (프로덕션 모드용 - 사용자가 서명한 트랜잭션 처리)
   */
  @Post('link-pet/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: 'Guardian Link Pet - 사용자 서명 트랜잭션으로 Pet 연결' })
  async linkPet(
    @Req() req: Request,
    @Param('petDID') petDID: string,
    @Body() body: { signedTx: string }
  ) {
    const guardianAddress = req.user?.address;

    try {
      const result = await this.guardianService.linkPet(
        guardianAddress,
        petDID,
        body.signedTx
      );

      return {
        success: true,
        ...result,
        message: `Pet ${petDID} linked to guardian ${guardianAddress}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prepare Guardian Link Transaction Data (사용자가 서명할 트랜잭션 데이터 생성)
   */
  @Post('prepare-link-pet/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: 'Guardian Link 트랜잭션 데이터 준비 - 사용자가 서명해야 함' })
  async prepareLinkPet(
    @Req() req: Request,
    @Param('petDID') petDID: string
  ) {
    const guardianAddress = req.user?.address;

    const txData = await this.guardianService.prepareLinkPetTx(
      guardianAddress,
      petDID
    );

    return {
      success: true,
      transactionData: txData,
      instruction: 'Sign this transaction with your wallet and call POST /api/guardian/link-pet/:petDID with the signed transaction'
    };
  }
}

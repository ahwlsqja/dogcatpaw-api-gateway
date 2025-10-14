// api-gateway/src/vc/vc.controller.ts
import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { Request } from 'express';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from './vc.proxy.service';
import { VcService } from './vc.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('vc')
@ApiBearerAuth()
@ApiTags('VC')
export class VcController {
  constructor(
    private vcProxyService: VcProxyService,
    private vcService: VcService,
  ) {}

  /**
   * Step 1: 서명할 데이터 준비
   */
  @Post('prepare-vc-signing')
  @UseGuards(DIDAuthGuard)
  async prepareVCSigning(@Body() body: any, @Req() req: Request) {
    const guardianAddress = req.user.address;
    const { petDID, biometricHash, petData } = body;

    return this.vcService.prepareVCSigning({
      guardianAddress,
      petDID,
      biometricHash,
      petData,
    });
  }

  /**
   * Step 2: 서명 받아서 VC 생성
   */
  @Post('create-vc-with-signature')
  @UseGuards(DIDAuthGuard)
  async createVCWithSignature(@Body() body: any, @Req() req: Request) {
    const guardianAddress = req.user.address;
    const { signature, message, petDID, petData } = body;

    return this.vcService.createVCWithSignature({
      guardianAddress,
      signature,
      message,
      petDID,
      petData,
    });
  }

  /**
   * VC 조회
   */
  @Get('pet/:petDID')
  @UseGuards(DIDAuthGuard)
  async getVC(@Param('petDID') petDID: string, @Req() req: Request) {
    return this.vcService.getVC(petDID, req.user.address);
  }

  /**
   * Health Check - VC 서비스 gRPC 연결 상태 확인
   */
  @Get('health')
  async healthCheck() {
    try {
      const result = await this.vcProxyService.healthCheck({
        service: 'VCService',
      });
      return {
        status: 'success',
        grpcStatus: result.status,
        message: result.message,
        timestamp: result.timestamp,
        version: result.version,
      };
    } catch (error) {
      return {
        status: 'error',
        grpcStatus: 'NOT_SERVING',
        message: error.message || 'Failed to connect to VC gRPC service',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
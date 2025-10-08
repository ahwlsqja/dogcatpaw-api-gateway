// api-gateway/src/email/email.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { EmailService } from './email.service';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  SendVerificationCodeDto,
  SendVerificationCodeResponseDto
} from './dto/send-verification-code.dto';
import {
  VerifyEmailCodeDto,
  VerifyEmailCodeResponseDto
} from './dto/verify-email-code.dto';

@Controller('api/email')
@ApiBearerAuth()
@ApiTags('Email')
export class EmailController {

  constructor(
    private emailService: EmailService,
    private vcProxyService: VcProxyService,
  ) {}

  @Post('send-code')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '이메일 인증 코드 발송' })
  @ApiResponse({
    status: 200,
    description: '인증 코드 발송 성공',
    type: SendVerificationCodeResponseDto
  })
  async sendCode(
    @Body() dto: SendVerificationCodeDto,
    @Req() req: Request
  ): Promise<SendVerificationCodeResponseDto> {
    const walletAddress = req.user.address;
    return this.emailService.sendVerificationCode(walletAddress, dto.email);
  }

  @Post('verify-code')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '이메일 인증 코드 검증' })
  @ApiResponse({
    status: 200,
    description: '인증 코드 검증 결과',
    type: VerifyEmailCodeResponseDto
  })
  async verifyCode(
    @Body() dto: VerifyEmailCodeDto,
    @Req() req: Request
  ): Promise<VerifyEmailCodeResponseDto> {
    const walletAddress = req.user.address;

    // 1. 코드 검증
    const result = await this.emailService.verifyCode(walletAddress, dto.code);

    if (!result.success) {
      return result;
    }

    // 2. VC Service에 Auth 등록 (gRPC)
    try {
      const authResult = await this.vcProxyService.registerAuth({ walletAddress });

      return {
        success: true,
        message: '이메일 검증이 완료되었고 계정이 등록되었습니다!',
      };
    } catch (error) {
      console.error('계정 등록 중 에러가 발생했습니다!:', error);
      return {
        success: true, // 이메일 인증은 성공
        warning: '이메일 검증은 성공이 성공했습니다!',
      };
    }
  }
}
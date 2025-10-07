// api-gateway/src/vc/vc.controller.ts
import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { Request } from 'express';

import { ethers } from 'ethers';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from './vc.proxy.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('vc')
@ApiBearerAuth()
@ApiTags('VC')
export class VcController {
  constructor(private vcProxyService: VcProxyService) {}

  /**
   * Step 1: 서명할 데이터 준비
   */
  @Post('prepare-vc-signing')
  @UseGuards(DIDAuthGuard)
  async prepareVCSigning(@Body() body: any, @Req() req: Request) {
    const guardianAddress = req.user.address;
    const { petDID, biometricHash, petData } = body;

    // 서명할 메시지 생성
    const message = {
      vcType: 'PetIdentityCredential',
      sub: petDID,
      guardian: guardianAddress,
      biometricHash,
      petData,
      issuedAt: new Date().toISOString(),
      nonce: Math.random().toString(36).substring(2),
    };

    // 메시지 해시
    const messageHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(message))
    );

    return {
      message,
      messageHash,
      instruction: 'Please sign this message to create Pet VC',
    };
  }

  /**
   * Step 2: 서명 받아서 VC 생성
   */
  @Post('create-vc-with-signature')
  @UseGuards(DIDAuthGuard)
  async createVCWithSignature(@Body() body: any, @Req() req: Request) {
    const guardianAddress = req.user.address;
    const { signature, message, petDID, petData } = body;

    // 서명 검증
    const messageHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(message))
    );
    const recoveredAddress = ethers.recoverAddress(messageHash, signature);

    if (recoveredAddress.toLowerCase() !== guardianAddress.toLowerCase()) {
      return { success: false, error: 'Invalid signature' };
    }

    // VC JWT 조립 (보호자가 issuer)
    const vcJwt = this.assembleVCJWT({
      issuer: guardianAddress,
      signature,
      petDID,
      petData,
      message,
    });

    // gRPC로 VC Service에 저장 요청
    const result = await this.vcProxyService.storeVC({
      guardianAddress,
      petDID,
      vcJwt,
      metadata: petData,
    });

    return result;
  }

  /**
   * VC JWT 조립 (did-jwt 형식)
   */
  private assembleVCJWT(data: any): string {
    // JWT Header
    const header = {
      alg: 'ES256K-R', // Ethereum 서명 알고리즘
      typ: 'JWT',
    };

    // VC Payload
    const payload = {
      iss: `did:ethr:besu:${data.issuer}`,
      sub: data.petDID,
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000 + 86400 * 365),
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'PetIdentityCredential'],
        credentialSubject: {
          id: data.petDID,
          guardian: data.issuer,
          ...data.petData,
        },
      },
    };

    // Base64 인코딩
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    // 서명은 이미 클라이언트에서 받음
    const encodedSignature = Buffer.from(data.signature.slice(2), 'hex').toString('base64url');

    // JWT 조립
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * VC 조회
   */
  @Get('pet/:petDID')
  @UseGuards(DIDAuthGuard)
  async getVC(@Param('petDID') petDID: string, @Req() req: Request) {
    return this.vcProxyService.getVC({
      petDID,
      guardianAddress: req.user.address,
    });
  }
}
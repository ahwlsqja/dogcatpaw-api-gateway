import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { VcProxyService } from './vc.proxy.service';

export interface PrepareVCSigningParams {
  guardianAddress: string;
  petDID: string;
  biometricHash: string;
  petData: any;
}

export interface CreateVCParams {
  guardianAddress: string;
  signature: string;
  message: any;
  petDID: string;
  petData: any;
}

@Injectable()
export class VcService {
  constructor(private vcProxyService: VcProxyService) {}

  /**
   * Step 1: 서명할 데이터 준비 (JWT 표준 방식)
   */
  prepareVCSigning(params: PrepareVCSigningParams) {
    const { guardianAddress, petDID, biometricHash, petData } = params;

    const now = Math.floor(Date.now() / 1000);

    // JWT Header
    const header = {
      alg: 'ES256K-R',
      typ: 'JWT',
    };

    // JWT Payload
    const payload = {
      iss: `did:ethr:besu:${guardianAddress}`,
      sub: petDID,
      nbf: now,
      exp: now + 86400 * 365, // 1 year
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'PetIdentityCredential'],
        credentialSubject: {
          id: petDID,
          guardian: guardianAddress,
          biometricHash,
          ...petData,
        },
      },
    };

    // JWT 표준: header.payload를 서명
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingData = `${encodedHeader}.${encodedPayload}`;

    // 메시지 해시
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(signingData));

    return {
      message: payload, // payload를 message로 전달 (호환성)
      messageHash,
      signingData, // 정확한 서명 데이터
      header,
      encodedHeader,
      encodedPayload,
      instruction: 'Please sign this message to create Pet VC',
    };
  }

  /**
   * Step 2: 서명 받아서 VC 생성
   */
  async createVCWithSignature(params: CreateVCParams) {
    const { guardianAddress, signature, message, petDID, petData } = params;

    // JWT payload 재구성 (서명 검증용)
    const header = {
      alg: 'ES256K-R',
      typ: 'JWT',
    };

    const payload = message; // prepareVCSigning에서 전달한 payload 사용

    // JWT 표준 서명 검증
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingData = `${encodedHeader}.${encodedPayload}`;

    // ethers.verifyMessage already hashes with Ethereum prefix internally
    // So we pass signingData directly, not the hash
    const recoveredAddress = ethers.verifyMessage(signingData, signature);

    if (recoveredAddress.toLowerCase() !== guardianAddress.toLowerCase()) {
      console.error('❌ VC Signature Verification Failed:');
      console.error(`  Expected: ${guardianAddress}`);
      console.error(`  Recovered: ${recoveredAddress}`);
      console.error(`  Signing Data: ${signingData.substring(0, 100)}...`);
      console.error(`  Signature: ${signature.substring(0, 20)}...`);
      return { success: false, errorMessage: 'Invalid signature' };
    }

    console.log(`✅ VC Signature Verified: ${guardianAddress}`);

    // VC JWT 조립 (이미 검증된 header, payload, signature 사용)
    const vcJwt = this.assembleVCJWT({
      header,
      payload,
      signature,
    });

    const result = await this.vcProxyService.storeVC({
      guardianAddress,
      petDID,
      vcJwt,
    });

    return result;
  }

  /**
   * VC JWT 조립 (did-jwt 형식)
   */
  assembleVCJWT(data: { header: any; payload: any; signature: string }): string {
    // Base64url 인코딩
    const encodedHeader = Buffer.from(JSON.stringify(data.header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(data.payload)).toString('base64url');

    // 서명은 이미 클라이언트에서 받음 (0x 제거 후 base64url 인코딩)
    const encodedSignature = Buffer.from(data.signature.slice(2), 'hex').toString('base64url');

    // JWT 조립: header.payload.signature
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * VC 조회
   */
  async getVC(petDID: string, guardianAddress: string) {
    return this.vcProxyService.getVC({
      petDID,
      guardianAddress,
    });
  }

  /**
   * 소유권 이전을 위한 서명 준비 (JWT 표준 방식)
   */
  prepareTransferVCSigning(params: {
    previousGuardian: string;
    newGuardian: string;
    petDID: string;
    biometricHash: string;
    petData: any;
  }) {
    const { previousGuardian, newGuardian, petDID, biometricHash, petData } = params;

    const now = Math.floor(Date.now() / 1000);

    // JWT Header
    const header = {
      alg: 'ES256K-R',
      typ: 'JWT',
    };

    // JWT Payload (Transfer VC)
    const payload = {
      iss: `did:ethr:besu:${newGuardian}`,
      sub: petDID,
      nbf: now,
      exp: now + 86400 * 365, // 1 year
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'PetTransferCredential'],
        credentialSubject: {
          id: petDID,
          guardian: newGuardian,
          previousGuardian,
          biometricHash,
          transferDate: new Date().toISOString(),
          ...petData,
        },
      },
    };

    // JWT 표준: header.payload를 서명
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingData = `${encodedHeader}.${encodedPayload}`;

    // 메시지 해시
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(signingData));

    return {
      message: payload, // payload를 message로 전달
      messageHash,
      signingData,
      header,
      encodedHeader,
      encodedPayload,
      instruction: 'New guardian must sign to accept pet transfer',
    };
  }

  /**
   * 이전 VC 생성 (서명 검증 후)
   */
  async createTransferVC(params: {
    newGuardian: string;
    signature: string;
    message: any;
    vcSignedData: string;
    petDID: string;
    petData: any;
  }) {
    const { newGuardian, signature, message, vcSignedData, petDID, petData } = params;

    // JWT payload (from prepare-transfer response)
    const header = {
      alg: 'ES256K-R',
      typ: 'JWT',
    };

    const payload = message; // prepareTransferVCSigning에서 전달한 payload 사용

    // Use the exact signingData from prepare-transfer (no re-calculation!)
    const signingData = vcSignedData;

    const recoveredAddress = ethers.verifyMessage(signingData, signature);

    if (recoveredAddress.toLowerCase() !== newGuardian.toLowerCase()) {
      console.error('❌ Transfer VC Signature Verification Failed:');
      console.error(`  Expected: ${newGuardian}`);
      console.error(`  Recovered: ${recoveredAddress}`);
      return { success: false, errorMessage: 'Invalid signature' };
    }

    console.log(`✅ Transfer VC Signature Verified: ${newGuardian}`);

    // VC JWT 조립
    const vcJwt = this.assembleVCJWT({
      header,
      payload,
      signature,
    });

    const result = await this.vcProxyService.storeVC({
      guardianAddress: newGuardian,
      petDID,
      vcJwt,
    });

    return result;
  }
}

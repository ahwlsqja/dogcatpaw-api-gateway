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
   * Step 1: 서명할 데이터 준비
   */
  prepareVCSigning(params: PrepareVCSigningParams) {
    const { guardianAddress, petDID, biometricHash, petData } = params;

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
  async createVCWithSignature(params: CreateVCParams) {
    const { guardianAddress, signature, message, petDID, petData } = params;

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
  assembleVCJWT(data: any): string {
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
  async getVC(petDID: string, guardianAddress: string) {
    return this.vcProxyService.getVC({
      petDID,
      guardianAddress,
    });
  }

  /**
   * 소유권 이전을 위한 서명 준비
   */
  prepareTransferVCSigning(params: {
    previousGuardian: string;
    newGuardian: string;
    petDID: string;
    biometricHash: string;
    petData: any;
  }) {
    const { previousGuardian, newGuardian, petDID, biometricHash, petData } = params;

    // 이전용 메시지 생성
    const message = {
      vcType: 'PetTransferCredential', // 타입 변경
      sub: petDID,
      guardian: newGuardian, // 새 보호자
      previousGuardian, // 이전 보호자 추가
      biometricHash,
      petData,
      transferDate: new Date().toISOString(),
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
    petDID: string;
    petData: any;
  }) {
    const { newGuardian, signature, message, petDID, petData } = params;

    // 서명 검증
    const messageHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(message))
    );
    const recoveredAddress = ethers.recoverAddress(messageHash, signature);

    if (recoveredAddress.toLowerCase() !== newGuardian.toLowerCase()) {
      return { success: false, error: 'Invalid signature' };
    }

    // VC JWT 조립 (새 보호자가 issuer)
    const vcJwt = this.assembleVCJWT({
      issuer: newGuardian,
      signature,
      petDID,
      petData: {
        ...petData,
        previousGuardian: message.previousGuardian,
        transferDate: message.transferDate,
      },
      message,
    });

    const result = await this.vcProxyService.storeVC({
      guardianAddress: newGuardian,
      petDID,
      vcJwt,
    });

    return result;
  }
}

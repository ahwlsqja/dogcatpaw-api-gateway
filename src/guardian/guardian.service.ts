// api-gateway/src/guardian/guardian.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { GuardianRegistryABI, getAddress } from '../abis';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';

@Injectable()
export class GuardianService {
  private provider: ethers.Provider;
  private adminSigner: ethers.Wallet | null = null;
  private guardianContract: ethers.Contract;

  constructor(private configService: ConfigService) {
    // RPC_URL 환경변수 사용
    this.provider = new ethers.JsonRpcProvider(
      this.configService.get<string>('RPC_URL')
    );

    // ADMIN_PRIVATE_KEY가 있을 경우에만 admin signer 설정
    const adminPrivateKey = this.configService.get<string>('ADMIN_PRIVATE_KEY');
    if (adminPrivateKey) {
      this.adminSigner = new ethers.Wallet(adminPrivateKey, this.provider);
    }

    this.guardianContract = new ethers.Contract(
      getAddress('GuardianRegistry'),
      GuardianRegistryABI,
      this.provider  // 기본적으로 읽기 전용 provider 사용
    );
  }

  /**
   * 트랜잭션 데이터 준비 (프론트엔드에서 서명용)
   */
  async prepareRegisterGuardianTx(
    guardianAddress: string,
    personalDataHash: string,
    ncpStorageURI: string,
    verificationMethod: number
  ) {
    const data = this.guardianContract.interface.encodeFunctionData(
      'registerGuardian',
      [personalDataHash, ncpStorageURI, verificationMethod]
    );

    return {
      to: getAddress('GuardianRegistry'),
      data,
      from: guardianAddress,
      gasLimit: 0, // 프라이빗 네트워크 - 가스비 0
      gasPrice: 0,
      value: 0
    };
  }

  /**
   * 서명된 트랜잭션 전송 (프로덕션 모드)
   */
  async sendSignedTransaction(signedTx: string) {
    const tx = await this.provider.broadcastTransaction(signedTx);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * 보호자 등록
   * - 개발: ADMIN_PRIVATE_KEY로 대신 서명
   * - 프로덕션: 트랜잭션 데이터만 반환
   */
  async registerGuardian(
    guardianAddress: string,
    personalDataHash: string,
    ncpStorageURI: string,
    verificationMethod: number,
    signedTx?: string  // 프로덕션에서 프론트엔드가 서명한 트랜잭션
  ) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // 프로덕션 모드 + 서명된 트랜잭션이 있는 경우
    if (!isDevelopment && signedTx) {
      return this.sendSignedTransaction(signedTx);
    }

    // 프로덕션 모드 + 서명된 트랜잭션이 없는 경우: 트랜잭션 데이터만 반환
    if (!isDevelopment && !signedTx) {
      return {
        requiresSignature: true,
        transactionData: await this.prepareRegisterGuardianTx(
          guardianAddress,
          personalDataHash,
          ncpStorageURI,
          verificationMethod
        ),
        message: 'Please sign this transaction with your wallet'
      };
    }

    // 개발 모드: 관리자 키로 대신 서명
    if (isDevelopment && this.adminSigner) {
      const contractWithSigner = this.guardianContract.connect(this.adminSigner);
      // NCP 저장 대신 더미 데이터 사용
      const dummyDataHash = personalDataHash || "0x0000000000000000000000000000000000000000000000000000000000000001";
      const dummyStorageURI = "0"; // NCP 저장 안함
      const tx = await contractWithSigner['registerGuardian'](
        dummyDataHash,
        dummyStorageURI,
        verificationMethod || 1
      );

      const receipt = await tx.wait();
      const event = receipt.logs?.find((log: any) => {
        try {
          const parsed = this.guardianContract.interface.parseLog(log);
          return parsed?.name === 'GuardianRegistered';
        } catch {
          return false;
        }
      });

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        event: event ? this.guardianContract.interface.parseLog(event).args : null,
      };
    }

    throw new Error('Unable to process transaction');
  }

  /**
   * 보호자 검증 (VERIFIER_ROLE 필요 - 관리자만)
   */
  async verifyGuardian(
    guardianAddress: string,
    smsVerified: boolean,
    emailVerified: boolean
  ) {
    if (!this.adminSigner) {
      throw new Error('Admin private key required for verification');
    }

    const contractWithSigner = this.guardianContract.connect(this.adminSigner);
    const tx = await contractWithSigner['verifyGuardian'](
      guardianAddress,
      smsVerified,
      emailVerified
    );

    const receipt = await tx.wait();
    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };
  }

  /**
   * 트랜잭션 데이터 준비 - 보호자 데이터 업데이트
   */
  async prepareUpdateGuardianDataTx(
    guardianAddress: string,
    newPersonalDataHash: string,
    newNcpStorageURI: string
  ) {
    const data = this.guardianContract.interface.encodeFunctionData(
      'updateGuardianData',
      [newPersonalDataHash, newNcpStorageURI]
    );

    return {
      to: getAddress('GuardianRegistry'),
      data,
      from: guardianAddress,
      gasLimit: 0,
      gasPrice: 0,
      value: 0
    };
  }

  /**
   * 보호자 데이터 업데이트
   */
  async updateGuardianData(
    guardianAddress: string,
    newPersonalDataHash: string,
    newNcpStorageURI: string,
    signedTx?: string
  ) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!isDevelopment && signedTx) {
      return this.sendSignedTransaction(signedTx);
    }

    if (!isDevelopment && !signedTx) {
      return {
        requiresSignature: true,
        transactionData: await this.prepareUpdateGuardianDataTx(
          guardianAddress,
          newPersonalDataHash,
          newNcpStorageURI
        ),
        message: 'Please sign this transaction with your wallet'
      };
    }

    if (isDevelopment && this.adminSigner) {
      const contractWithSigner = this.guardianContract.connect(this.adminSigner);
      const dummyDataHash = newPersonalDataHash || "0x0000000000000000000000000000000000000000000000000000000000000001";
      const dummyStorageURI = "0"; // NCP 저장 안함
      const tx = await contractWithSigner['updateGuardianData'](
        dummyDataHash,
        dummyStorageURI
      );

      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    }

    throw new Error('Unable to process transaction');
  }

  /**
   * 트랜잭션 데이터 준비 - 펫 연결
   */
  async prepareLinkPetTx(guardianAddress: string, petDID: string) {
    const data = this.guardianContract.interface.encodeFunctionData(
      'linkPet',
      [petDID]
    );

    return {
      to: getAddress('GuardianRegistry'),
      data,
      from: guardianAddress,
      gasLimit: 0,
      gasPrice: 0,
      value: 0
    };
  }

  /**
   * 펫 연결
   */
  async linkPet(guardianAddress: string, petDID: string, signedTx?: string) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!isDevelopment && signedTx) {
      return this.sendSignedTransaction(signedTx);
    }

    if (!isDevelopment && !signedTx) {
      return {
        requiresSignature: true,
        transactionData: await this.prepareLinkPetTx(guardianAddress, petDID),
        message: 'Please sign this transaction with your wallet'
      };
    }

    if (isDevelopment && this.adminSigner) {
      const contractWithSigner = this.guardianContract.connect(this.adminSigner);
      const tx = await contractWithSigner['linkPet'](petDID);
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    }

    throw new Error('Unable to process transaction');
  }

  /**
   * 트랜잭션 데이터 준비 - 펫 연결 해제
   */
  async prepareUnlinkPetTx(guardianAddress: string, petDID: string) {
    const data = this.guardianContract.interface.encodeFunctionData(
      'unlinkPet',
      [petDID]
    );

    return {
      to: getAddress('GuardianRegistry'),
      data,
      from: guardianAddress,
      gasLimit: 0,
      gasPrice: 0,
      value: 0
    };
  }

  /**
   * 펫 연결 해제
   */
  async unlinkPet(guardianAddress: string, petDID: string, signedTx?: string) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!isDevelopment && signedTx) {
      return this.sendSignedTransaction(signedTx);
    }

    if (!isDevelopment && !signedTx) {
      return {
        requiresSignature: true,
        transactionData: await this.prepareUnlinkPetTx(guardianAddress, petDID),
        message: 'Please sign this transaction with your wallet'
      };
    }

    if (isDevelopment && this.adminSigner) {
      const contractWithSigner = this.guardianContract.connect(this.adminSigner);
      const tx = await contractWithSigner['unlinkPet'](petDID);
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    }

    throw new Error('Unable to process transaction');
  }

  /**
   * 보호자 프로필 조회 (읽기 전용)
   */
  async getGuardianProfile(guardianAddress: string) {
    const profile = await this.guardianContract['getGuardianProfile'](guardianAddress);

    return {
      guardianAddress: profile.guardianAddress,
      personalDataHash: profile.personalDataHash,
      ncpStorageURI: profile.ncpStorageURI,
      verificationMethod: Number(profile.verificationMethod),
      verificationLevel: Number(profile.verificationLevel),
      registeredAt: Number(profile.registeredAt),
      lastUpdated: Number(profile.lastUpdated),
      isActive: profile.isActive,
    };
  }

  /**
   * 보호자 펫 목록 조회 (읽기 전용)
   */
  async getGuardianPets(guardianAddress: string): Promise<string[]> {
    return this.guardianContract['getGuardianPets'](guardianAddress);
  }

  /**
   * 검증 증명 조회 (읽기 전용)
   */
  async getVerificationProof(guardianAddress: string) {
    const proof = await this.guardianContract['getVerificationProof'](guardianAddress);

    return {
      smsVerified: proof.smsVerified,
      emailVerified: proof.emailVerified,
      smsVerifiedAt: Number(proof.smsVerifiedAt),
      emailVerifiedAt: Number(proof.emailVerifiedAt),
      verifier: proof.verifier,
    };
  }

  /**
   * 전체 보호자 수 (읽기 전용)
   */
  async getTotalGuardians(): Promise<number> {
    const total = await this.guardianContract['getTotalGuardians']();
    return Number(total);
  }

  /**
   * 보호자 등록 여부 확인 (읽기 전용)
   */
  async isGuardianRegistered(guardianAddress: string): Promise<boolean> {
    try {
      const profile = await this.getGuardianProfile(guardianAddress);
      return profile.isActive;
    } catch {
      return false;
    }
  }
}

// api-gateway/src/pet/pet.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PetDIDRegistryABI, getAddress } from '../abis';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetService {
  private provider: ethers.Provider;
  private adminSigner: ethers.Wallet | null = null;
  private petContract: ethers.Contract;

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

    // ConfigService에서 컨트랙트 주소 가져오기
    const petDIDRegistryAddress = this.configService.get<string>('PET_DID_REGISTRY_ADDRESS');
    if (!petDIDRegistryAddress) {
      throw new Error('PET_DID_REGISTRY_ADDRESS is not configured in environment variables');
    }

    this.petContract = new ethers.Contract(
      petDIDRegistryAddress,
      PetDIDRegistryABI,
      this.provider  // 기본적으로 읽기 전용 provider 사용
    );
  }

  /**
   * 트랜잭션 데이터 준비 - PetDID 등록
   */
  async prepareRegisterPetDIDTx(
    petDID: string,
    featureVectorHash: string,
    modelServerReference: string,
    sampleCount: number,
    species: string,
    metadataURI: string
  ) {
    const data = this.petContract.interface.encodeFunctionData(
      'registerPetDID',
      [petDID, featureVectorHash, modelServerReference, sampleCount, species, metadataURI]
    );

    return {
      to: await this.petContract.getAddress(),
      data,
      from: this.adminSigner?.address,
      gasLimit: 0, // 프라이빗 네트워크
      gasPrice: 0,
      value: 0
    };
  }

  /**
   * 서명된 트랜잭션 전송
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
   * PetDID 등록
   */
  async registerPetDID(
    petDID: string,
    featureVectorHash: string,
    modelServerReference: string,
    sampleCount: number,
    species: string,
    metadataURI: string,
    signedTx?: string
  ) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // 프로덕션 모드 + 서명된 트랜잭션이 있는 경우
    if (!isDevelopment && signedTx) {
      return this.sendSignedTransaction(signedTx);
    }

    // 프로덕션 모드 + 서명된 트랜잭션이 없는 경우
    if (!isDevelopment && !signedTx) {
      return {
        requiresSignature: true,
        transactionData: await this.prepareRegisterPetDIDTx(
          petDID,
          featureVectorHash,
          modelServerReference,
          sampleCount,
          species,
          metadataURI
        ),
        message: 'Please sign this transaction with your wallet'
      };
    }

    // 개발 모드: 관리자 키로 대신 서명
    if (isDevelopment && this.adminSigner) {
      const contractWithSigner = this.petContract.connect(this.adminSigner);
      const tx = await contractWithSigner['registerPetDID'](
        petDID,
        featureVectorHash,
        modelServerReference || 'model-server-ref',
        sampleCount || 1,
        species || 'unknown',
        metadataURI || '0'
      );

      const receipt = await tx.wait();
      const event = receipt.logs?.find((log: any) => {
        try {
          const parsed = this.petContract.interface.parseLog(log);
          return parsed?.name === 'DIDCreated';
        } catch {
          return false;
        }
      });

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        event: event ? this.petContract.interface.parseLog(event).args : null,
      };
    }

    throw new Error('Unable to process transaction');
  }

  /**
   * 비문 검증
   */
  async verifyBiometric(
    petDID: string,
    similarity: number,
    purpose: number,
    modelServerSignature: string
  ): Promise<boolean> {
    const result = await this.petContract['verifyBiometric'](
      petDID,
      similarity,
      purpose,
      modelServerSignature
    );
    return result;
  }

  /**
   * 트랜잭션 데이터 준비 - Controller 변경
   */
  async prepareChangeControllerTx(petDID: string, newController: string) {
    const data = this.petContract.interface.encodeFunctionData(
      'changeController',
      [petDID, newController]
    );

    return {
      to: await this.petContract.getAddress(),
      data,
      from: this.adminSigner?.address,
      gasLimit: 0,
      gasPrice: 0,
      value: 0
    };
  }

  /**
   * Controller 변경
   */
  async changeController(petDID: string, newController: string, signedTx?: string) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!isDevelopment && signedTx) {
      return this.sendSignedTransaction(signedTx);
    }

    if (!isDevelopment && !signedTx) {
      return {
        requiresSignature: true,
        transactionData: await this.prepareChangeControllerTx(petDID, newController),
        message: 'Please sign this transaction with your wallet'
      };
    }

    if (isDevelopment && this.adminSigner) {
      const contractWithSigner = this.petContract.connect(this.adminSigner);
      const tx = await contractWithSigner['changeController'](petDID, newController);
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
   * DID Document 조회 (읽기 전용)
   */
  async getDIDDocument(petDID: string) {
    const result = await this.petContract['getDIDDocument'](petDID);

    return {
      biometricOwner: result.biometricOwner,
      controller: result.controller,
      created: Number(result.created),
      updated: Number(result.updated),
      exists: result.exists,
    };
  }

  /**
   * 비문 데이터 조회 (읽기 전용)
   */
  async getBiometricData(petDID: string) {
    const result = await this.petContract['getBiometricData'](petDID);

    return {
      featureVectorHash: result.featureVectorHash,
      modelServerReference: result.modelServerReference,
      sampleCount: Number(result.sampleCount),
      registrationTime: Number(result.registrationTime),
    };
  }

  /**
   * Controller별 펫 조회 (읽기 전용)
   */
  async getPetsByController(controller: string): Promise<string[]> {
    return this.petContract['getPetsByController'](controller);
  }

  /**
   * 전체 펫 수 (읽기 전용)
   */
  async getTotalPets(): Promise<number> {
    const total = await this.petContract['getTotalPets']();
    return Number(total);
  }

  /**
   * Credential 등록
   */
  async registerCredential(
    credentialHash: string,
    credentialType: string,
    subject: string,
    expirationDate: number,
    signedTx?: string
  ) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isDevelopment && this.adminSigner) {
      const contractWithSigner = this.petContract.connect(this.adminSigner);
      const tx = await contractWithSigner['registerCredential'](
        credentialHash,
        credentialType,
        subject,
        expirationDate
      );
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    }

    throw new Error('Credential registration requires admin key');
  }

  /**
   * Credential 취소
   */
  async revokeCredential(credentialHash: string, signedTx?: string) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isDevelopment && this.adminSigner) {
      const contractWithSigner = this.petContract.connect(this.adminSigner);
      const tx = await contractWithSigner['revokeCredential'](credentialHash);
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    }

    throw new Error('Credential revocation requires admin key');
  }

  /**
   * Credential 유효성 확인 (읽기 전용)
   */
  async isCredentialValid(credentialHash: string): Promise<boolean> {
    return this.petContract['isCredentialValid'](credentialHash);
  }

  /**
   * Pet 존재 여부 확인 (읽기 전용)
   */
  async isPetRegistered(petDID: string): Promise<boolean> {
    try {
      const didDoc = await this.getDIDDocument(petDID);
      return didDoc.exists;
    } catch {
      return false;
    }
  }
}

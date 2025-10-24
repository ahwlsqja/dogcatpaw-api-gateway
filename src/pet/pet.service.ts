// api-gateway/src/pet/pet.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PetDIDRegistryABI } from '../abis';
import { envVariableKeys } from 'src/common/const/env.const';

@Injectable()
export class PetService {
  private provider: ethers.Provider;
  private adminSigner: ethers.Wallet | null = null;
  private petContract: ethers.Contract;

  constructor(private configService: ConfigService) {
    // RPC_URL 환경변수 사용
    this.provider = new ethers.JsonRpcProvider(
      this.configService.get<string>(envVariableKeys.rpcurl)
    );

    // ADMIN_PRIVATE_KEY가 있을 경우에만 admin signer 설정
    const adminPrivateKey = this.configService.get<string>(envVariableKeys.keyofadmin);
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
    console.log('🔍 [sendSignedTransaction] Received signedTx length:', signedTx.length);
    console.log('🔍 [sendSignedTransaction] signedTx preview:', signedTx.substring(0, 100) + '...');

    try {
      const tx = await this.provider.broadcastTransaction(signedTx);
      console.log('🔍 [sendSignedTransaction] Broadcasted tx hash:', tx.hash);
      console.log('🔍 [sendSignedTransaction] Tx to:', tx.to);
      console.log('🔍 [sendSignedTransaction] Tx data length:', tx.data.length);
      console.log('🔍 [sendSignedTransaction] Tx data preview:', tx.data.substring(0, 100));

      // Wait with timeout (30 seconds)
      console.log('⏳ [sendSignedTransaction] Waiting for transaction confirmation...');
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timeout after 30 seconds')), 30000)
        )
      ]) as any;

      console.log('✅ [sendSignedTransaction] Transaction confirmed in block:', receipt.blockNumber);

      // Check if transaction was successful
      if (receipt.status === 0) {
        console.error(`❌ Transaction reverted - Block: ${receipt.blockNumber}, Hash: ${tx.hash}`);
        throw new Error('Transaction was mined but reverted on-chain');
      }

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error('❌ [sendSignedTransaction] Error:', error.message);
      // Import and use blockchain error classifier
      const { createBlockchainErrorResponse } = await import('../common/const/blockchain-error-codes');
      return createBlockchainErrorResponse(error);
    }
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
   * 비문 검증 with Admin Signature (개발용)
   * Admin이 MODEL_SERVER_ROLE을 가지고 있다고 가정
   */
  async verifyBiometricWithAdminSignature(
    petDID: string,
    similarity: number,
    purpose: number
  ): Promise<boolean> {
    if (!this.adminSigner) {
      throw new Error('Admin signer not available');
    }

    // Create the message hash exactly as the contract expects
    const messageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'uint8', 'uint8', 'uint256'],
        [petDID, similarity, purpose, Math.floor(Date.now() / 1000)]
      )
    );

    // Sign with admin key (admin should have MODEL_SERVER_ROLE)
    const signature = await this.adminSigner.signMessage(ethers.getBytes(messageHash));

    // Call the contract with admin signature
    const contractWithSigner = this.petContract.connect(this.adminSigner);
    const result = await contractWithSigner['verifyBiometric'](
      petDID,
      similarity,
      purpose,
      signature
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

  /**
   * Get pet controller/ownership history from blockchain events
   */
  async getPetControllerHistory(petDID: string) {
    // Get DIDCreated event to find initial owner
    const createdFilter = this.petContract.filters.DIDCreated(petDID);
    const createdEvents = await this.petContract.queryFilter(createdFilter);

    // Get all ControllerChanged events for this pet
    const changedFilter = this.petContract.filters.ControllerChanged(petDID);
    const changedEvents = await this.petContract.queryFilter(changedFilter);

    const history = [];

    // Add initial registration
    if (createdEvents.length > 0) {
      const event = createdEvents[0];
      const block = await event.getBlock();

      // Parse the log to get args - handle both EventLog and Log types
      let parsedLog: any;
      if ('args' in event) {
        parsedLog = event;
      } else {
        parsedLog = this.petContract.interface.parseLog({
          topics: event.topics as string[],
          data: event.data
        });
      }

      history.push({
        type: 'registered',
        petDID,
        controller: parsedLog.args.controller,
        previousController: null,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: block.timestamp,
        date: new Date(block.timestamp * 1000).toISOString()
      });
    }

    // Add all ownership transfers
    for (const event of changedEvents) {
      const block = await event.getBlock();

      // Parse the log to get args - handle both EventLog and Log types
      let parsedLog: any;
      if ('args' in event) {
        parsedLog = event;
      } else {
        parsedLog = this.petContract.interface.parseLog({
          topics: event.topics as string[],
          data: event.data
        });
      }

      history.push({
        type: 'transferred',
        petDID,
        controller: parsedLog.args.newController,
        previousController: parsedLog.args.oldController,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: block.timestamp,
        date: new Date(block.timestamp * 1000).toISOString()
      });
    }

    return {
      petDID,
      currentController: history.length > 0
        ? history[history.length - 1].controller
        : null,
      totalTransfers: changedEvents.length,
      history: history.sort((a, b) => a.timestamp - b.timestamp)
    };
  }

  /**
   * Get verification history for a pet
   */
  async getVerificationHistory(petDID: string) {
    const result = await this.petContract['getVerificationHistory'](petDID);

    return result.map((record: any) => ({
      verifier: record.verifier,
      timestamp: Number(record.timestamp),
      date: new Date(Number(record.timestamp) * 1000).toISOString(),
      similarity: Number(record.similarity),
      purpose: Number(record.purpose),
      purposeText: this.getPurposeText(Number(record.purpose))
    }));
  }

  /**
   * Check if address is authorized guardian for pet
   */
  async isAuthorizedGuardian(petDID: string, guardianAddress: string): Promise<boolean> {
    return this.petContract['isAuthorizedGuardian'](petDID, guardianAddress);
  }

  /**
   * Helper to convert purpose number to text
   */
  private getPurposeText(purpose: number): string {
    const purposes: { [key: number]: string } = {
      0: 'general_verification',
      1: 'emergency_access',
      2: 'ownership_transfer',
      3: 'medical_record',
      4: 'shelter_intake'
    };
    return purposes[purpose] || `unknown_${purpose}`;
  }
}

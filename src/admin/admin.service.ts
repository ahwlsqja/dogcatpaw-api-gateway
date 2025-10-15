// api-gateway/src/admin/admin.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PetService } from 'src/pet/pet.service';
import { GuardianService } from 'src/guardian/guardian.service';
import { envVariableKeys } from 'src/common/const/env.const';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private provider: ethers.Provider;
  private adminSigner: ethers.Wallet | null = null;
  private adminAddress: string | null = null;

  constructor(
    private configService: ConfigService,
    private petService: PetService,
    private guardianService: GuardianService,
  ) {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(
      this.configService.get<string>(envVariableKeys.rpcurl)
    );

    // Initialize admin signer if key is available
    const adminPrivateKey = this.configService.get<string>(envVariableKeys.keyofadmin);
    if (adminPrivateKey) {
      this.adminSigner = new ethers.Wallet(adminPrivateKey, this.provider);
      this.adminAddress = this.adminSigner.address;
      this.logger.log(`Admin service initialized with address: ${this.adminAddress}`);
    } else {
      this.logger.warn('Admin private key not configured - some operations will be unavailable');
    }
  }

  /**
   * Blockchain Health Check
   */
  async healthCheck() {
    try {
      const startTime = Date.now();

      // Test 1: Get network info
      const network = await this.provider.getNetwork();

      // Test 2: Get latest block number
      const blockNumber = await this.provider.getBlockNumber();

      // Test 3: Get latest block
      const block = await this.provider.getBlock(blockNumber);

      // Test 4: Check admin account balance (if available)
      let adminBalance = null;
      let adminBalanceEth = null;
      if (this.adminAddress) {
        adminBalance = await this.provider.getBalance(this.adminAddress);
        adminBalanceEth = ethers.formatEther(adminBalance);
      }

      // Test 5: Get contract addresses
      const petContractAddress = this.configService.get<string>('PET_DID_REGISTRY_ADDRESS');
      const guardianContractAddress = this.configService.get<string>(envVariableKeys.guardianregistryaddress);

      // Test 6: Check if contracts have code (deployed)
      const petContractCode = await this.provider.getCode(petContractAddress);
      const guardianContractCode = await this.provider.getCode(guardianContractAddress);

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        network: {
          name: network.name,
          chainId: network.chainId.toString(),
        },
        blockchain: {
          latestBlock: blockNumber,
          blockTimestamp: block ? Number(block.timestamp) : null,
          blockDate: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
        },
        admin: {
          address: this.adminAddress,
          balance: adminBalance ? adminBalance.toString() : null,
          balanceEth: adminBalanceEth,
        },
        contracts: {
          petDIDRegistry: {
            address: petContractAddress,
            deployed: petContractCode !== '0x' && petContractCode.length > 2,
            codeLength: petContractCode.length,
          },
          guardianRegistry: {
            address: guardianContractAddress,
            deployed: guardianContractCode !== '0x' && guardianContractCode.length > 2,
            codeLength: guardianContractCode.length,
          },
        },
      };
    } catch (error) {
      this.logger.error('Health check failed:', error.message);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Get blockchain statistics
   */
  async getBlockchainStats() {
    try {
      // Get total pets from PetDIDRegistry
      const totalPets = await this.petService.getTotalPets();

      // Get total guardians from GuardianRegistry
      const totalGuardians = await this.guardianService.getTotalGuardians();

      // Get latest block info
      const blockNumber = await this.provider.getBlockNumber();
      const block = await this.provider.getBlock(blockNumber);

      // Get network info
      const network = await this.provider.getNetwork();

      return {
        success: true,
        timestamp: new Date().toISOString(),
        network: {
          name: network.name,
          chainId: network.chainId.toString(),
        },
        stats: {
          totalPets,
          totalGuardians,
          latestBlock: blockNumber,
          blockTimestamp: block ? Number(block.timestamp) : null,
          blockDate: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get blockchain stats:', error.message);
      throw error;
    }
  }

  /**
   * Get guardian profile by address
   */
  async getGuardianProfile(guardianAddress: string) {
    try {
      const profile = await this.guardianService.getGuardianProfile(guardianAddress);
      const pets = await this.guardianService.getGuardianPets(guardianAddress);
      const verification = await this.guardianService.getVerificationProof(guardianAddress);

      return {
        success: true,
        profile: {
          ...profile,
          registeredAtDate: new Date(profile.registeredAt * 1000).toISOString(),
          lastUpdatedDate: new Date(profile.lastUpdated * 1000).toISOString(),
        },
        pets,
        verification: {
          ...verification,
          smsVerifiedAtDate: verification.smsVerifiedAt
            ? new Date(verification.smsVerifiedAt * 1000).toISOString()
            : null,
          emailVerifiedAtDate: verification.emailVerifiedAt
            ? new Date(verification.emailVerifiedAt * 1000).toISOString()
            : null,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get guardian profile for ${guardianAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Get pet DID document and biometric data
   */
  async getPetInfo(petDID: string) {
    try {
      const didDoc = await this.petService.getDIDDocument(petDID);
      const biometricData = await this.petService.getBiometricData(petDID);

      // Try to get verification history (may not exist in older contracts)
      let verificationHistory = [];
      try {
        verificationHistory = await this.petService.getVerificationHistory(petDID);
      } catch (error) {
        this.logger.warn(`Verification history not available for ${petDID}: ${error.message}`);
      }

      // Try to get controller history (may hit RPC range limit on large blockchains)
      let controllerHistory = null;
      try {
        controllerHistory = await this.petService.getPetControllerHistory(petDID);
      } catch (error) {
        this.logger.warn(`Controller history not available for ${petDID}: ${error.message}`);
        if (error.message.includes('RPC range limit')) {
          controllerHistory = {
            error: 'History too large - RPC range limit exceeded',
            suggestion: 'Use blockchain explorer or query specific block ranges',
          };
        }
      }

      return {
        success: true,
        petDID,
        didDocument: {
          ...didDoc,
          createdDate: new Date(didDoc.created * 1000).toISOString(),
          updatedDate: new Date(didDoc.updated * 1000).toISOString(),
        },
        biometricData: {
          ...biometricData,
          registrationDate: new Date(biometricData.registrationTime * 1000).toISOString(),
        },
        verificationHistory,
        controllerHistory,
      };
    } catch (error) {
      this.logger.error(`Failed to get pet info for ${petDID}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all pets by controller address
   */
  async getPetsByController(controllerAddress: string) {
    try {
      const pets = await this.petService.getPetsByController(controllerAddress);

      return {
        success: true,
        controller: controllerAddress,
        totalPets: pets.length,
        pets,
      };
    } catch (error) {
      this.logger.error(`Failed to get pets for controller ${controllerAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if address is authorized guardian for a pet
   */
  async checkAuthorization(petDID: string, guardianAddress: string) {
    try {
      const isAuthorized = await this.petService.isAuthorizedGuardian(petDID, guardianAddress);

      return {
        success: true,
        petDID,
        guardianAddress,
        isAuthorized,
      };
    } catch (error) {
      this.logger.error(`Failed to check authorization:`, error.message);
      throw error;
    }
  }

  /**
   * Get transaction receipt by hash
   */
  async getTransactionReceipt(txHash: string) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }

      const block = await this.provider.getBlock(receipt.blockNumber);

      return {
        success: true,
        receipt: {
          transactionHash: receipt.hash,
          from: receipt.from,
          to: receipt.to,
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status,
          logs: receipt.logs.length,
          timestamp: block ? Number(block.timestamp) : null,
          date: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get transaction receipt for ${txHash}:`, error.message);
      throw error;
    }
  }

  /**
   * Get block by number
   */
  async getBlock(blockNumber: number) {
    try {
      const block = await this.provider.getBlock(blockNumber);

      if (!block) {
        return {
          success: false,
          error: 'Block not found',
        };
      }

      return {
        success: true,
        block: {
          number: block.number,
          hash: block.hash,
          timestamp: Number(block.timestamp),
          date: new Date(Number(block.timestamp) * 1000).toISOString(),
          transactions: block.transactions.length,
          miner: block.miner,
          gasUsed: block.gasUsed?.toString(),
          gasLimit: block.gasLimit?.toString(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get block ${blockNumber}:`, error.message);
      throw error;
    }
  }
}

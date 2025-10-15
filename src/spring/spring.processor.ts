// api-gateway/src/spring/spring.processor.ts
import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { firstValueFrom } from 'rxjs';
import { VcProxyService } from 'src/vc/vc.proxy.service';

export interface UserSyncJob {
  walletAddress: string;
  action: 'register' | 'update' | 'delete';
  guardianInfo?: any;
  petInfo?: any;
}

export interface PetTransferJob {
  petDID: string;
  previousOwner: string;
  newOwner: string;
  transferredAt: Date;
}

export interface VPDeliveryJob {
  walletAddress: string;
  vpJwt: string;
  purpose: string;
  targetEndpoint?: string;
}

export interface PetRegistrationJob {
  guardianAddress: string;
  petDID: string;
  petData: {
    petName?: string;
    breed?: string;
    old?: number;
    weight?: number;
    gender?: string;
    color?: string;
    feature?: string;
    neutered?: boolean;
    species: string;
  };
  registeredAt: Date;
}

@Processor('spring-sync')
@Injectable()
export class SpringProcessor {
  private readonly logger = new Logger(SpringProcessor.name);
  private springBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly vcProxyService: VcProxyService,
  ) {
    this.springBaseUrl = this.configService.get<string>('SPRING_SERVER_URL') || 'http://localhost:8080';
    this.logger.log('Spring Processor initialized');
  }

  @OnQueueActive()
  onActive(job: Job) {
    if (job.name === 'sync-user') {
      const data = job.data as UserSyncJob;
      this.logger.log(`Processing job ${job.id} - Syncing user ${data.walletAddress} to Spring (${data.action})`);
    } else if (job.name === 'sync-transfer') {
      const data = job.data as PetTransferJob;
      this.logger.log(`Processing job ${job.id} - Syncing pet transfer for ${data.petDID}`);
    } else if (job.name === 'deliver-vp') {
      const data = job.data as VPDeliveryJob;
      this.logger.log(`Processing job ${job.id} - Delivering VP for ${data.walletAddress}`);
    } else if (job.name === 'sync-pet-registration') {
      const data = job.data as PetRegistrationJob;
      this.logger.log(`Processing job ${job.id} - Syncing pet registration for ${data.petDID}`);
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed - Type: ${job.name}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `❌ Job ${job.id} failed - Type: ${job.name} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
      error.stack
    );
  }

  /**
   * Sync user (guardian) data to Spring server
   */
  @Process('sync-user')
  async handleUserSync(job: Job<UserSyncJob>) {
    const { walletAddress, action, guardianInfo } = job.data;

    try {
      const startTime = Date.now();

      // 1. Get all VCs from vc-service
      const vcsResponse = await this.vcProxyService.getVCsByWallet({
        walletAddress
      }).catch(() => ({ vcs: [] }));
      const vcs = vcsResponse.vcs || [];

      // 2. Get guardian info if not provided
      let guardian = guardianInfo;
      if (!guardian && action !== 'delete') {
        guardian = await this.vcProxyService.getGuardianInfo({
          walletAddress
        }).catch(() => null);
      }

      // 3. Prepare data for Spring
      const springData = {
        walletAddress,
        did: `did:ethr:besu:${walletAddress}`,
        guardian,
        credentials: {
          total: vcs.length,
          pets: vcs.filter((vc: any) => vc.vcType === 'PetOwnership').map((vc: any) => ({
            petDID: vc.credentialSubject?.petDID,
            name: vc.credentialSubject?.name,
            species: vc.credentialSubject?.species,
          })),
        },
        action,
        timestamp: new Date().toISOString(),
      };

      // 4. Send to Spring server
      let endpoint = '';
      let method: 'post' | 'put' | 'delete' = 'post';

      switch (action) {
        case 'register':
          endpoint = '/api/auth/signup';
          method = 'post';
          break;
        case 'update':
          endpoint = `/api/users/${walletAddress}`;
          method = 'put';
          break;
        case 'delete':
          endpoint = `/api/users/${walletAddress}`;
          method = 'delete';
          break;
      }

      const response = await firstValueFrom(
        this.httpService[method](
          `${this.springBaseUrl}${endpoint}`,
          springData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      const duration = Date.now() - startTime;
      this.logger.debug(`Spring sync took ${duration}ms for ${walletAddress}`);

      return {
        success: true,
        walletAddress,
        action,
        springResponse: response.data,
        duration
      };
    } catch (error) {
      this.logger.error(`Spring sync error for ${walletAddress}:`, error.message);
      throw error; // Bull will retry
    }
  }

  /**
   * Sync pet ownership transfer to Spring
   */
  @Process('sync-transfer')
  async handleTransferSync(job: Job<PetTransferJob>) {
    const { petDID, previousOwner, newOwner, transferredAt } = job.data;

    try {
      const startTime = Date.now();

      // Prepare transfer notification for Spring
      const transferData = {
        petDID,
        previousOwner,
        newOwner,
        transferredAt,
        notificationType: 'ownership_transfer',
      };

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}/api/pets/ownership-transfer`,
          transferData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      const duration = Date.now() - startTime;
      this.logger.debug(`Transfer sync took ${duration}ms for pet ${petDID}`);

      return {
        success: true,
        petDID,
        duration,
        springResponse: response.data
      };
    } catch (error) {
      this.logger.error(`Transfer sync error for ${petDID}:`, error.message);
      throw error;
    }
  }

  /**
   * Deliver VP to Spring server for authentication/authorization
   */
  @Process('deliver-vp')
  async handleVPDelivery(job: Job<VPDeliveryJob>) {
    const { walletAddress, vpJwt, purpose, targetEndpoint } = job.data;

    try {
      const startTime = Date.now();

      const endpoint = targetEndpoint || '/api/auth/verify-vp';

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}${endpoint}`,
          {
            vpJwt,
            walletAddress,
            purpose,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
              'X-Wallet-Address': walletAddress,
            }
          }
        )
      );

      const duration = Date.now() - startTime;
      this.logger.debug(`VP delivery took ${duration}ms for ${walletAddress}`);

      return {
        success: true,
        walletAddress,
        verified: response.data.verified,
        duration
      };
    } catch (error) {
      this.logger.error(`VP delivery error for ${walletAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync pet registration to Spring server
   */
  @Process('sync-pet-registration')
  async handlePetRegistration(job: Job<PetRegistrationJob>) {
    const { guardianAddress, petDID, petData, registeredAt } = job.data;

    try {
      const startTime = Date.now();

      // Prepare pet registration data for Spring
      const springData = {
        guardianAddress,
        guardianDID: `did:ethr:besu:${guardianAddress}`,
        petDID,
        petData: {
          ...petData,
          registeredAt: new Date(registeredAt).toISOString(),
        },
        notificationType: 'pet_registration',
        timestamp: new Date().toISOString(),
      };

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}/api/pet`,
          springData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      const duration = Date.now() - startTime;
      this.logger.debug(`Pet registration sync took ${duration}ms for pet ${petDID}`);

      return {
        success: true,
        petDID,
        guardianAddress,
        duration,
        springResponse: response.data
      };
    } catch (error) {
      this.logger.error(`Pet registration sync error for ${petDID}:`, error.message);
      throw error;
    }
  }
}
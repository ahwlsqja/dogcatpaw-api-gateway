// api-gateway/src/spring/spring.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';

@Injectable()
export class SpringService {
  private readonly logger = new Logger(SpringService.name);
  private springBaseUrl: string;

  constructor(
    @InjectQueue('spring-sync') private readonly springQueue: Queue,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.springBaseUrl = this.configService.get<string>(envVariableKeys.springurl) || 'http://localhost:8080';
  }

  /**
   * Queue user registration to Spring (async for quick response)
   * Maps guardian DTO fields to Spring API /api/auth/signup
   */
  async queueUserRegister(
    walletAddress: string,
    guardianDto: {
      email?: string;
      phone?: string;
      name?: string;
      gender?: string;
      old?: number;
      address?: string;
    }
  ) {
    const job = await this.springQueue.add('register', {
      walletAddress,
      email: guardianDto.email,
      phone: guardianDto.phone,
      name: guardianDto.name,
      gender: guardianDto.gender,
      old: guardianDto.old,
      address: guardianDto.address,
    }, {
      priority: 1,
    });

    this.logger.log(`Queued user registration job ${job.id} for ${walletAddress}`);
    return job.id;
  }

  /**
   * Queue user sync to Spring (update/delete only)
   */
  async queueUserSync(
    walletAddress: string,
    action: 'update' | 'delete',
    userData?: any
  ) {
    const job = await this.springQueue.add('sync-user', {
      walletAddress,
      action,
      userData
    }, {
      priority: 2,
    });

    this.logger.log(`Queued user sync job ${job.id} for ${walletAddress} (${action})`);
    return job.id;
  }

  /**
   * Queue pet ownership transfer notification to Spring
   */
  async queueTransferNotification(
    petDID: string,
    previousOwner: string,
    newOwner: string
  ) {
    const job = await this.springQueue.add('sync-transfer', {
      petDID,
      previousOwner,
      newOwner,
      transferredAt: new Date(),
    }, {
      priority: 1,
    });

    this.logger.log(`Queued transfer sync job ${job.id} for pet ${petDID}`);
    return job.id;
  }

  /**
   * Queue VP delivery to Spring
   */
  async queueVPDelivery(
    walletAddress: string,
    vpJwt: string,
    purpose: string,
    targetEndpoint?: string
  ) {
    const job = await this.springQueue.add('deliver-vp', {
      walletAddress,
      vpJwt,
      purpose,
      targetEndpoint
    }, {
      priority: 1,
    });

    this.logger.log(`Queued VP delivery job ${job.id} for ${walletAddress}`);
    return job.id;
  }

  /**
   * Queue pet registration to Spring
   */
  async queuePetRegistration(
    guardianAddress: string,
    petDID: string,
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
    }
  ) {
    const job = await this.springQueue.add('sync-pet-registration', {
      guardianAddress,
      petDID,
      petData,
      registeredAt: new Date(),
    }, {
      priority: 1,
    });

    this.logger.log(`Queued pet registration job ${job.id} for pet ${petDID}`);
    return job.id;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    const job = await this.springQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress(),
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
    };
  }

  /**
   * Direct sync call to Spring (when immediate response needed)
   */
  async directSyncUser(walletAddress: string, userData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}/api/users/sync-did-user`,
          {
            walletAddress,
            did: `did:ethr:besu:${walletAddress}`,
            ...userData,
            timestamp: new Date().toISOString(),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      this.logger.error('Direct Spring sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user data from Spring
   */
  async getUserFromSpring(walletAddress: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.springBaseUrl}/api/users/by-wallet/${walletAddress}`,
          {
            headers: {
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get user from Spring:`, error);
      return null;
    }
  }

  /**
   * Send notification to Spring
   */
  async sendNotification(type: string, data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}/api/notifications`,
          {
            type,
            data,
            timestamp: new Date().toISOString(),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      return {
        success: true,
        notificationId: response.data.id
      };
    } catch (error) {
      this.logger.error('Failed to send notification to Spring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
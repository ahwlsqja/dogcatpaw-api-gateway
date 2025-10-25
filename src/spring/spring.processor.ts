// api-gateway/src/spring/spring.processor.ts
import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { firstValueFrom } from 'rxjs';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { Role } from 'src/common/enums/role.enum';

export interface UserSyncJob {
  walletAddress: string;
  action: 'update' | 'delete';
  userData?: any;
}

export interface UserRegisterJob {
  walletAddress: string;
  email?: string;
  phone?: string;
  name?: string;
  gender?: string;
  old?: number;
  address?: string;
  nickname?: string;
  profileUrl?: string;
}

export interface PetTransferJob {
  adoptionId: number,
  newGuardian: string;
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
    neutral?: boolean;
    specifics: string;
    images: string;
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
    if (job.name === 'register-user') {
      const data = job.data as UserRegisterJob;
      this.logger.log(`Processing job ${job.id} - Registering user ${data.walletAddress} to Spring`);
    } else if (job.name === 'register-admin') {
      const data = job.data as UserRegisterJob;
      this.logger.log(`Processing job ${job.id} - Registering admin ${data.walletAddress} to Spring`)
    } else if (job.name === 'sync-user') {
      const data = job.data as UserSyncJob;
      this.logger.log(`Processing job ${job.id} - Syncing user ${data.walletAddress} to Spring (${data.action})`);
    } else if (job.name === 'sync-pet-transfer') {
      const data = job.data as PetTransferJob;
      this.logger.log(`Processing job ${job.id} - Syncing pet transfer for ${data.adoptionId}`);
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
   * Register new user to Spring server (signup)
   * Maps guardian DTO fields to Spring API /api/auth/signup
   */
  @Process('register-user')
  async handleUserRegister(job: Job<UserRegisterJob>) {
    const {
      walletAddress,
      email,
      phone,
      name,
      gender,
      old,
      address,
      profileUrl,
      nickname
    } = job.data;

    try {
      const startTime = Date.now();

      // Map guardian DTO fields to Spring API signup fields
      const signupData = {
        walletAddress,
        username: name || walletAddress?.substring(0, 10) || 'unknown',
        nickname: nickname || walletAddress?.substring(0, 8) || 'unknown',
        gender: gender || '',
        old: old || 0,
        address: address || '',
        phoneNumber: phone || '',
        type: 'GUARDIAN',
        email: email || '',
        profileUrl: profileUrl,
        role: Role.USER,
      };

      this.logger.debug(`Registering user to Spring: ${JSON.stringify(signupData)}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}/api/auth/signup`,
          signupData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      const duration = Date.now() - startTime;
      this.logger.log(`✅ User registration to Spring took ${duration}ms for ${walletAddress}`);

      return {
        success: true,
        walletAddress,
        springResponse: response.data,
        duration
      };
    } catch (error) {
      this.logger.error(`❌ Spring registration error for ${walletAddress}:`, error.message);
      throw error; // Bull will retry
    }
  }

  @Process('register-admin')
  async handleAdminRegister(job: Job<UserRegisterJob>) {
    const {
      walletAddress,
      email,
      phone,
      name,
      gender,
      old,
      address,
      profileUrl,
      nickname
    } = job.data;

    try {
      const startTime = Date.now();

      // Map guardian DTO fields to Spring API signup fields
      const signupData = {
        walletAddress,
        username: name || walletAddress?.substring(0, 10) || 'unknown',
        nickname: nickname || walletAddress?.substring(0, 8) || 'unknown',
        gender: gender || '',
        old: old || 0,
        address: address || '',
        phoneNumber: phone || '',
        type: 'GUARDIAN',
        email: email || '',
        profileUrl: profileUrl,
        role: Role.ADMIN,
      };

      this.logger.debug(`Registering user to Spring: ${JSON.stringify(signupData)}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}/api/auth/signup`,
          signupData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      const duration = Date.now() - startTime;
      this.logger.log(`✅ User registration to Spring took ${duration}ms for ${walletAddress}`);

      return {
        success: true,
        walletAddress,
        springResponse: response.data,
        duration
      };
    } catch (error) {
      this.logger.error(`❌ Spring registration error for ${walletAddress}:`, error.message);
      throw error; // Bull will retry
    }
  }

  /**
   * Sync user (guardian) data to Spring server (update/delete only)
   */
  @Process('sync-user')
  async handleUserSync(job: Job<UserSyncJob>) {
    const { walletAddress, action, userData } = job.data;

    try {
      const startTime = Date.now();

      // Send to Spring server
      let endpoint = '';
      let method: 'put' | 'delete' = 'put';

      switch (action) {
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
          userData || {},
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
            }
          }
        )
      );

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Spring ${action} sync took ${duration}ms for ${walletAddress}`);

      return {
        success: true,
        walletAddress,
        action,
        springResponse: response.data,
        duration
      };
    } catch (error) {
      this.logger.error(`❌ Spring ${action} error for ${walletAddress}:`, error.message);
      throw error; // Bull will retry
    }
  }

  /**
   * Sync pet ownership transfer to Spring
   */
  @Process('sync-pet-transfer')
  async handleTransferSync(job: Job<PetTransferJob>) {
    const { adoptionId, newGuardian } = job.data;

    try {
      const startTime = Date.now();

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}/api/adoption/${adoptionId}/complete`,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
              'X-Wallet-Address': newGuardian,
            }
          }
        )
      );

      const duration = Date.now() - startTime;
      this.logger.debug(`Transfer sync took ${duration}ms for pet ${adoptionId}`);

      return {
        success: true,
        adoptionId,
        duration,
        springResponse: response.data
      };
    } catch (error) {
      this.logger.error(`Transfer sync error for ${adoptionId}:`, error.message);
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
        did: petDID,
        ...petData,
      };

      console.log(springData)

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.springBaseUrl}/api/pet`,
          springData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Gateway': 'dogcatpaw',
              'X-Wallet-Address': guardianAddress,
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
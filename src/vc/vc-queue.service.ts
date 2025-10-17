// api-gateway/src/vc/vc-queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class VcQueueService {
  private readonly logger = new Logger(VcQueueService.name);

  constructor(
    @InjectQueue('vc-queue') private readonly vcQueue: Queue,
  ) {}

  /**
   * Queue VC transfer processing (invalidate old VC + create new VC)
   */
  async queueVCTransfer(
    petDID: string,
    newGuardian: string,
    previousGuardian: string,
    signature: string,
    message: any,
    petData: any
  ) {
    const job = await this.vcQueue.add('process-vc-transfer', {
      petDID,
      newGuardian,
      previousGuardian,
      signature,
      message,
      petData
    }, {
      priority: 2, // Medium priority
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2s delay
      }
    });

    this.logger.log(`Queued VC transfer job ${job.id} for ${petDID}`);
    return job.id;
  }

  /**
   * Queue Guardian Info Sync to VC Service
   */
  async queueGuardianSync(
    walletAddress: string,
    email: string,
    phone?: string,
    name?: string,
  ) {
    const job = await this.vcQueue.add('sync-guardian-info', {
      walletAddress,
      email,
      phone,
      name,
      isEmailVerified: true,
      isOnChainRegistered: true,
    }, {
      priority: 1, // High priority
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      }
    });

    this.logger.log(`Queued guardian sync job ${job.id} for ${walletAddress}`);
    return job.id;
  }

  /**
   * Queue Pet VC creation (after pet registration)
   */
  async queuePetVCCreation(
    petDID: string,
    guardianAddress: string,
    featureVectorHash: string,
    petData: any,
    vcSignature: string,  // 보호자의 실제 서명
    message: any  // 서명된 원본 메시지
  ) {
    const job = await this.vcQueue.add('create-pet-vc', {
      petDID,
      guardianAddress,
      featureVectorHash,
      petData,
      vcSignature,  // 실제 서명 전달
      message,  // 원본 메시지 전달
    }, {
      priority: 2, // Medium priority
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2s delay
      }
    });

    this.logger.log(`Queued pet VC creation job ${job.id} for ${petDID}`);
    return job.id;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    const job = await this.vcQueue.getJob(jobId);
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
}

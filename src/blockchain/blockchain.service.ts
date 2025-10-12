// api-gateway/src/blockchain/blockchain.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  constructor(
    @InjectQueue('blockchain') private readonly blockchainQueue: Queue,
  ) {}

  /**
   * Queue biometric verification for async blockchain recording
   */
  async queueBiometricVerification(
    petDID: string,
    similarity: number,
    purpose: number,
    verifier?: string
  ) {
    const job = await this.blockchainQueue.add('verify-biometric', {
      petDID,
      similarity,
      purpose,
      verifier
    }, {
      priority: 1, // Higher priority for verification
    });

    this.logger.log(`Queued biometric verification job ${job.id} for ${petDID}`);
    return job.id;
  }

  /**
   * Queue guardian-pet link/unlink operation
   */
  async queueGuardianLink(
    guardianAddress: string,
    petDID: string,
    action: 'link' | 'unlink'
  ) {
    const job = await this.blockchainQueue.add('guardian-link', {
      guardianAddress,
      petDID,
      action
    }, {
      priority: 2,
    });

    this.logger.log(`Queued guardian ${action} job ${job.id} for ${petDID}`);
    return job.id;
  }

  /**
   * Queue controller transfer synchronization
   */
  async queueTransferSync(
    petDID: string,
    previousGuardian: string,
    newGuardian: string
  ) {
    const job = await this.blockchainQueue.add('sync-transfer', {
      petDID,
      previousGuardian,
      newGuardian
    }, {
      priority: 2,
    });

    this.logger.log(`Queued transfer sync job ${job.id} for ${petDID}`);
    return job.id;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    const job = await this.blockchainQueue.getJob(jobId);
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
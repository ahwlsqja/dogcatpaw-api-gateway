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
    action: 'link' | 'unlink',
    signedTx?: string  // 프로덕션: 사용자의 서명된 트랜잭션
  ) {
    const job = await this.blockchainQueue.add('guardian-link', {
      guardianAddress,
      petDID,
      action,
      signedTx
    }, {
      priority: 2,
    });

    this.logger.log(`Queued guardian ${action} job ${job.id} for ${petDID}`);
    return job.id;
  }

  /**
   * Queue guardian-pet link with user signature (production mode)
   */
  async queueGuardianLinkWithSignature(
    guardianAddress: string,
    petDID: string,
    signedTx: string
  ) {
    return this.queueGuardianLink(guardianAddress, petDID, 'link', signedTx);
  }

  /**
   * Queue controller transfer synchronization
   */
  async queueTransferSync(
    petDID: string,
    previousGuardian: string,
    newGuardian: string,
    unlinkSignedTx?: string,  // 프로덕션: previousGuardian의 unlink 트랜잭션 서명
    linkSignedTx?: string      // 프로덕션: newGuardian의 link 트랜잭션 서명
  ) {
    const job = await this.blockchainQueue.add('sync-transfer', {
      petDID,
      previousGuardian,
      newGuardian,
      unlinkSignedTx,
      linkSignedTx
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
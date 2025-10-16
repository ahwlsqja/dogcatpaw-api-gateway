// api-gateway/src/vc/vc.processor.ts
import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { VCTransferJob } from 'src/common/interceptor/Blockchain.interface';
import { VcService } from './vc.service';
import { VcProxyService } from './vc.proxy.service';

@Processor('vc-queue')
@Injectable()
export class VcProcessor {
  private readonly logger = new Logger(VcProcessor.name);

  constructor(
    private readonly vcService: VcService,
    private readonly vcProxyService: VcProxyService,
  ) {
    this.logger.log('VC Processor initialized');
  }

  @OnQueueActive()
  onActive(job: Job) {
    if (job.name === 'process-vc-transfer') {
      const data = job.data as VCTransferJob;
      this.logger.log(`Processing job ${job.id} - Processing VC transfer for pet: ${data.petDID}`);
    } else if (job.name === 'sync-guardian-info') {
      this.logger.log(`Processing job ${job.id} - Syncing guardian info for: ${job.data.walletAddress}`);
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    if (job.name === 'process-vc-transfer') {
      const data = job.data as VCTransferJob;
      this.logger.log(`Job ${job.id} completed - VC transfer processed for pet: ${data.petDID}`);
    } else if (job.name === 'sync-guardian-info') {
      this.logger.log(`Job ${job.id} completed - Guardian info synced for: ${job.data.walletAddress}`);
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    if (job.name === 'process-vc-transfer') {
      const data = job.data as VCTransferJob;
      this.logger.error(
        `Job ${job.id} failed - VC transfer for pet: ${data.petDID} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
        error.stack
      );
    } else if (job.name === 'sync-guardian-info') {
      this.logger.error(
        `Job ${job.id} failed - Guardian sync for: ${job.data.walletAddress} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
        error.stack
      );
    }
  }

  /**
   * Process Guardian Info Sync to VC Service
   */
  @Process('sync-guardian-info')
  async handleGuardianSync(job: Job) {
    const { walletAddress, email, phone, name, isEmailVerified, isOnChainRegistered } = job.data;

    try {
      const startTime = Date.now();

      const result = await this.vcProxyService.updateGuardianInfo({
        walletAddress,
        email,
        phone,
        name,
        isEmailVerified,
        isOnChainRegistered,
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`Guardian sync took ${duration}ms for ${walletAddress}`);

      return {
        success: true,
        guardianId: result.guardianId,
        walletAddress,
        duration,
        message: 'Guardian info synced successfully'
      };
    } catch (error) {
      this.logger.error(`Guardian sync error for ${walletAddress}:`, error.message);
      throw error; // Bull will retry based on configuration
    }
  }

  /**
   * Process VC transfer (invalidate old VC + create new VC)
   */
  @Process('process-vc-transfer')
  async handleVCTransfer(job: Job<VCTransferJob>) {
    const { petDID, newGuardian, previousGuardian, signature, message, petData } = job.data;

    try {
      const startTime = Date.now();

      // 1. Invalidate previous guardian's VC
      try {
        await this.vcProxyService.invalidateVC({
          petDID,
          guardianAddress: previousGuardian,
          reason: 'ownership_transfer',
        });
        this.logger.debug(`Invalidated VC for previous guardian: ${previousGuardian}`);
      } catch (error) {
        this.logger.warn(`Failed to invalidate previous VC for ${previousGuardian}:`, error.message);
        // Continue - new VC creation is independent
      }

      // 2. Create new VC for new guardian
      try {
        const result = await this.vcService.createTransferVC({
          newGuardian,
          signature,
          message,
          petDID,
          petData,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to create transfer VC');
        }

        const duration = Date.now() - startTime;
        this.logger.debug(`VC transfer processing took ${duration}ms for ${petDID}`);

        return {
          success: true,
          petDID,
          newGuardian,
          previousGuardian,
          vcId: result.vcId,
          duration,
          message: 'VC transfer completed successfully'
        };
      } catch (error) {
        this.logger.error(`Failed to create transfer VC for ${newGuardian}:`, error.message);
        throw error;
      }
    } catch (error) {
      this.logger.error(`VC transfer processing error for ${petDID}:`, error.message);
      throw error; // Bull will retry based on configuration
    }
  }
}

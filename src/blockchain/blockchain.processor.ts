// api-gateway/src/blockchain/blockchain.processor.ts
import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { PetService } from '../pet/pet.service';
import { GuardianService } from '../guardian/guardian.service';
import { BiometricVerificationJob, ControllerTransferJob, GuardianLinkJob } from 'src/common/interceptor/Blockchain.interface';

@Processor('blockchain')
@Injectable()
export class BlockchainProcessor {
  private readonly logger = new Logger(BlockchainProcessor.name);
  private petService: PetService;
  private guardianService: GuardianService;

  constructor(private readonly configService: ConfigService) {
    this.logger.log('Blockchain Processor initialized');
  }

  // Lazy initialize services to avoid circular dependencies
  private async initServices() {
    if (!this.petService) {
      const { PetService } = await import('../pet/pet.service');
      this.petService = new PetService(this.configService);
    }
    if (!this.guardianService) {
      const { GuardianService } = await import('../guardian/guardian.service');
      this.guardianService = new GuardianService(this.configService);
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    // Match email processor's detailed logging pattern
    if (job.name === 'verify-biometric') {
      const data = job.data as BiometricVerificationJob;
      this.logger.log(`Processing job ${job.id} - Recording biometric verification for: ${data.petDID} (${data.similarity}%)`);
    } else if (job.name === 'guardian-link') {
      const data = job.data as GuardianLinkJob;
      this.logger.log(`Processing job ${job.id} - ${data.action === 'link' ? 'Linking' : 'Unlinking'} pet ${data.petDID} ${data.action === 'link' ? 'to' : 'from'} guardian: ${data.guardianAddress}`);
    } else if (job.name === 'sync-transfer') {
      const data = job.data as ControllerTransferJob;
      this.logger.log(`Processing job ${job.id} - Syncing transfer for pet: ${data.petDID}`);
    } else {
      this.logger.log(`Processing job ${job.id} - Type: ${job.name}`);
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    // Match email processor's success logging pattern
    if (job.name === 'verify-biometric') {
      const data = job.data as BiometricVerificationJob;
      this.logger.log(`Job ${job.id} completed - Biometric verification recorded for: ${data.petDID}`);
    } else if (job.name === 'guardian-link') {
      const data = job.data as GuardianLinkJob;
      this.logger.log(`Job ${job.id} completed - Pet ${data.petDID} ${data.action === 'link' ? 'linked to' : 'unlinked from'}: ${data.guardianAddress}`);
    } else if (job.name === 'sync-transfer') {
      const data = job.data as ControllerTransferJob;
      this.logger.log(`Job ${job.id} completed - Transfer synced for pet: ${data.petDID}`);
    } else {
      this.logger.log(`Job ${job.id} completed - Type: ${job.name}`);
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    // Match email processor's error logging pattern with details
    if (job.name === 'verify-biometric') {
      const data = job.data as BiometricVerificationJob;
      this.logger.error(
        `Job ${job.id} failed - Biometric verification for: ${data.petDID} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
        error.stack
      );
    } else if (job.name === 'guardian-link') {
      const data = job.data as GuardianLinkJob;
      this.logger.error(
        `Job ${job.id} failed - ${data.action} for pet: ${data.petDID} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
        error.stack
      );
    } else if (job.name === 'sync-transfer') {
      const data = job.data as ControllerTransferJob;
      this.logger.error(
        `Job ${job.id} failed - Transfer sync for pet: ${data.petDID} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
        error.stack
      );
    } else {
      this.logger.error(
        `Job ${job.id} failed - Type: ${job.name} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
        error.stack
      );
    }
  }

  /**
   * Process biometric verification recording on blockchain
   */
  @Process('verify-biometric')
  async handleBiometricVerification(job: Job<BiometricVerificationJob>) {
    await this.initServices();
    const { petDID, similarity, purpose } = job.data;

    try {
      const startTime = Date.now();
      const isDevelopment = process.env.NODE_ENV !== 'production';

      if (isDevelopment) {
        // Use admin signature in development
        await this.petService.verifyBiometricWithAdminSignature(
          petDID,
          similarity,
          purpose
        );

        const duration = Date.now() - startTime;
        this.logger.debug(`Blockchain verification took ${duration}ms for ${petDID}`);

        return {
          success: true,
          petDID,
          similarity,
          duration,
          message: 'Biometric verification recorded on blockchain'
        };
      } else {
        this.logger.warn('Skipping blockchain verification in production (MODEL_SERVER signature not available)');
        return {
          success: false,
          reason: 'Production mode - MODEL_SERVER signature not available'
        };
      }
    } catch (error) {
      this.logger.error(`Blockchain verification error for ${petDID}:`, error.message);
      throw error; // Bull will retry based on configuration
    }
  }

  /**
   * Process guardian-pet linking/unlinking
   */
  @Process('guardian-link')
  async handleGuardianLink(job: Job<GuardianLinkJob>) {
    await this.initServices();
    const { guardianAddress, petDID, action, signedTx } = job.data;

    try {
      const startTime = Date.now();

      if (action === 'link') {
        await this.guardianService.linkPet(guardianAddress, petDID, signedTx);
        this.logger.debug(`Pet ${petDID} linked to guardian ${guardianAddress}`);
      } else {
        await this.guardianService.unlinkPet(guardianAddress, petDID, signedTx);
        this.logger.debug(`Pet ${petDID} unlinked from guardian ${guardianAddress}`);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Guardian ${action} took ${duration}ms for ${petDID}`);

      return {
        success: true,
        action,
        petDID,
        guardianAddress,
        duration
      };
    } catch (error) {
      this.logger.error(`Guardian ${action} error for ${petDID}:`, error.message);
      throw error;
    }
  }

  /**
   * Process controller transfer synchronization
   */
  @Process('sync-transfer')
  async handleControllerTransferSync(job: Job<ControllerTransferJob>) {
    await this.initServices();
    const { petDID, previousGuardian, newGuardian, unlinkSignedTx, linkSignedTx } = job.data;

    try {
      const startTime = Date.now();

      // Unlink from previous guardian
      try {
        await this.guardianService.unlinkPet(previousGuardian, petDID, unlinkSignedTx);
        this.logger.debug(`Pet ${petDID} unlinked from previous guardian ${previousGuardian}`);
      } catch (error) {
        this.logger.warn(`Failed to unlink from previous guardian: ${error.message}`);
      }

      // Link to new guardian
      await this.guardianService.linkPet(newGuardian, petDID, linkSignedTx);
      this.logger.debug(`Pet ${petDID} linked to new guardian ${newGuardian}`);

      const duration = Date.now() - startTime;
      this.logger.debug(`Transfer sync took ${duration}ms for ${petDID}`);

      return {
        success: true,
        petDID,
        previousGuardian,
        newGuardian,
        duration
      };
    } catch (error) {
      this.logger.error(`Transfer sync error for ${petDID}:`, error.message);
      throw error;
    }
  }
}
// api-gateway/src/vc/vc.processor.ts
import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { VCTransferJob } from 'src/common/interceptor/Blockchain.interface';
import { VcService } from './vc.service';
import { VcProxyService } from './vc.proxy.service';
import { VCErrorCode, isRetryableError, VCErrorResponse } from 'src/common/const/vc-error-codes';

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

  /**
   * 에러 응답 검사 및 재시도 가능 여부 판단
   */
  private handleVCError(result: any, operationName: string): void {
    if (!result || result.success !== false) {
      return; // 성공 응답이거나 에러가 아님
    }

    const errorResponse = result as VCErrorResponse;

    this.logger.warn(
      `${operationName} failed - ErrorCode: ${errorResponse.errorCode}, Message: ${errorResponse.errorMessage}`
    );

    // 재시도 불가능한 에러 (4xxx)는 즉시 실패 처리
    if (!errorResponse.retryable) {
      this.logger.error(
        `${operationName} - Non-retryable error: ${errorResponse.errorCode}. Stopping retries.`
      );
      // Job을 영구 실패로 만들기 위해 특수 에러 던지기
      const error = new Error(errorResponse.errorMessage);
      error.name = 'NonRetryableError';
      (error as any).errorCode = errorResponse.errorCode;
      throw error;
    }

    // 재시도 가능한 에러 (5xxx)는 재시도를 위해 에러 던지기
    this.logger.warn(
      `${operationName} - Retryable error: ${errorResponse.errorCode}. Will retry.`
    );
    const error = new Error(errorResponse.errorMessage);
    (error as any).errorCode = errorResponse.errorCode;
    throw error;
  }

  @OnQueueActive()
  onActive(job: Job) {
    if (job.name === 'process-vc-transfer') {
      const data = job.data as VCTransferJob;
      this.logger.log(`Processing job ${job.id} - Processing VC transfer for pet: ${data.petDID}`);
    } else if (job.name === 'sync-guardian-info') {
      this.logger.log(`Processing job ${job.id} - Syncing guardian info for: ${job.data.walletAddress}`);
    } else if (job.name === 'create-pet-vc') {
      this.logger.log(`Processing job ${job.id} - Creating Pet VC for: ${job.data.petDID}`);
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    if (job.name === 'process-vc-transfer') {
      const data = job.data as VCTransferJob;
      this.logger.log(`Job ${job.id} completed - VC transfer processed for pet: ${data.petDID}`);
    } else if (job.name === 'sync-guardian-info') {
      this.logger.log(`Job ${job.id} completed - Guardian info synced for: ${job.data.walletAddress}`);
    } else if (job.name === 'create-pet-vc') {
      this.logger.log(`Job ${job.id} completed - Pet VC created for: ${job.data.petDID}`);
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
    } else if (job.name === 'create-pet-vc') {
      this.logger.error(
        `Job ${job.id} failed - Pet VC creation for: ${job.data.petDID} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
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

      // 에러 응답 체크
      this.handleVCError(result, 'Guardian Sync');

      const duration = Date.now() - startTime;
      this.logger.debug(`Guardian sync took ${duration}ms for ${walletAddress}`);

      return {
        success: true,
        guardianId: result.data?.guardianId,
        walletAddress,
        duration,
        message: result.message || 'Guardian info synced successfully'
      };
    } catch (error) {
      // gRPC 연결 에러 등 네트워크 오류는 재시도
      if (error.code === 14 || error.code === 'UNAVAILABLE') {
        this.logger.warn(`gRPC connection error for ${walletAddress} - Will retry`);
        throw error;
      }

      // NonRetryableError는 재시도하지 않음
      if (error.name === 'NonRetryableError') {
        this.logger.error(`Guardian sync permanently failed for ${walletAddress}: ${error.message}`);
        throw error;
      }

      // 기타 에러는 재시도
      this.logger.error(`Guardian sync error for ${walletAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Process Pet VC Creation (after pet registration)
   */
  @Process('create-pet-vc')
  async handlePetVCCreation(job: Job) {
    const { petDID, guardianAddress, featureVectorHash, petData, vcSignature, message } = job.data;

    try {
      const startTime = Date.now();

      // Create VC with guardian's real signature (보호자의 실제 서명 사용)
      // message는 이미 클라이언트가 서명한 원본 메시지를 사용
      const result = await this.vcService.createVCWithSignature({
        guardianAddress,
        signature: vcSignature,  // 실제 서명 사용!
        message: message,  // 원본 메시지 사용 (nonce가 일치함)
        petDID,
        petData,
      });

      // 에러 응답 체크
      if (!result.success) {
        // VC Service의 에러 응답 형태 확인
        if (result.errorCode) {
          this.handleVCError(result, 'Pet VC Creation');
        }
        // 기존 에러 형태 지원 (호환성)
        throw new Error(result.errorMessage || 'Failed to create pet VC');
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Pet VC creation took ${duration}ms for ${petDID}`);

      return {
        success: true,
        petDID,
        guardianAddress,
        vcId: result.data?.vcId,
        duration,
        message: 'Pet VC created successfully with guardian signature'
      };
    } catch (error) {
      // gRPC 연결 에러는 재시도
      if (error.code === 14 || error.code === 'UNAVAILABLE') {
        this.logger.warn(`gRPC connection error for ${petDID} - Will retry`);
        throw error;
      }

      // NonRetryableError는 재시도하지 않음
      if (error.name === 'NonRetryableError') {
        this.logger.error(`Pet VC creation permanently failed for ${petDID}: ${error.message}`);
        throw error;
      }

      this.logger.error(`Pet VC creation error for ${petDID}:`, error.message);
      throw error;
    }
  }

  /**
   * Process VC transfer (invalidate old VC + create new VC)
   */
  @Process('process-vc-transfer')
  async handleVCTransfer(job: Job<VCTransferJob>) {
    const { petDID, newGuardian, previousGuardian, signature, message, vcSignedData, petData } = job.data;

    try {
      const startTime = Date.now();

      // 1. Invalidate previous guardian's VC
      try {
        const invalidateResult = await this.vcProxyService.invalidateVC({
          petDID,
          guardianAddress: previousGuardian,
          reason: 'ownership_transfer',
        });

        // VC가 없는 경우는 무시 (이미 삭제되었거나 없을 수 있음)
        if (invalidateResult && !invalidateResult.success) {
          if (invalidateResult.errorCode === VCErrorCode.VC_NOT_FOUND) {
            this.logger.debug(`Previous VC not found for ${previousGuardian} - skipping invalidation`);
          } else {
            this.logger.warn(
              `Failed to invalidate previous VC: ${invalidateResult.errorCode} - ${invalidateResult.errorMessage}`
            );
          }
        } else {
          this.logger.debug(`Invalidated VC for previous guardian: ${previousGuardian}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to invalidate previous VC for ${previousGuardian}:`, error.message);
        // Continue - new VC creation is independent
      }

      // 2. Create new VC for new guardian
      const result = await this.vcService.createTransferVC({
        newGuardian,
        signature,
        message,
        vcSignedData,
        petDID,
        petData,
      });

      // 에러 응답 체크
      if (!result.success) {
        // VC Service의 에러 응답 형태 확인
        if (result.errorCode) {
          this.handleVCError(result, 'VC Transfer');
        }
        // 기존 에러 형태 지원 (호환성)
        throw new Error(result.errorMessage || 'Failed to create transfer VC');
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`VC transfer processing took ${duration}ms for ${petDID}`);

      return {
        success: true,
        petDID,
        newGuardian,
        previousGuardian,
        vcId: result.data?.vcId,
        duration,
        message: 'VC transfer completed successfully'
      };
    } catch (error) {
      // gRPC 연결 에러는 재시도
      if (error.code === 14 || error.code === 'UNAVAILABLE') {
        this.logger.warn(`gRPC connection error for ${petDID} - Will retry`);
        throw error;
      }

      // NonRetryableError는 재시도하지 않음
      if (error.name === 'NonRetryableError') {
        this.logger.error(`VC transfer permanently failed for ${petDID}: ${error.message}`);
        throw error;
      }

      this.logger.error(`VC transfer processing error for ${petDID}:`, error.message);
      throw error;
    }
  }
}

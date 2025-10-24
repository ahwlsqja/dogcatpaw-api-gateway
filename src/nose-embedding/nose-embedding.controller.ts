// 비문 추출하는 컨트롤러

import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NoseEmbedderProxyService } from './nose-embedding.proxy.service';
import { MLErrorCode, isRetryableError, MLErrorMessages } from 'src/common/const/ml-error-codes';

@Controller('nose-embedder')
@ApiBearerAuth()
@ApiTags('Nose-Embedder')
export class NoseEmbedderController {
  private readonly logger = new Logger(NoseEmbedderController.name);

  constructor(private readonly noseEmbedderService: NoseEmbedderProxyService) {}

  /**
   * POST /api/nose-embedder/extract
   * Upload a dog nose photo and get the feature vector
   */
  @Post('extract')
  @UseInterceptors(FileInterceptor('photo'))
  async extractNoseVector(@UploadedFile() file: Express.Multer.File) {
    // Validate file
    if (!file) {
      throw new BadRequestException('');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG and PNG are allowed',
      );
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    try {
      // Extract image format
      const imageFormat = file.mimetype.split('/')[1];
      console.log(file.buffer)

      // Call gRPC service
      const result = await this.noseEmbedderService.extractNoseVector(
        file.buffer,
        imageFormat,
      );

      // Check if extraction was successful
      if (!result.success) {
        // ML 서버에서 에러 코드를 반환한 경우
        if (result.errorCode) {
          this.logger.error(
            `ML Server Error: ${result.errorCode} - ${result.errorMessage} (Retryable: ${result.retryable})`
          );

          // 재시도 불가능한 클라이언트 에러 (4xxx)
          if (!result.retryable) {
            throw new HttpException(
              {
                success: false,
                errorCode: result.errorCode,
                errorMessage: result.errorMessage || MLErrorMessages[result.errorCode],
                retryable: false,
              },
              HttpStatus.BAD_REQUEST,
            );
          }

          // 재시도 가능한 서버 에러 (5xxx)
          throw new HttpException(
            {
              success: false,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage || MLErrorMessages[result.errorCode],
              retryable: true,
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        // 에러 코드 없이 실패한 경우 (레거시 호환)
        throw new HttpException(
          result.errorMessage || 'Failed to extract nose vector',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Return result
      return {
        success: true,
        vector: result.vector,
        vectorSize: result.vectorSize,
        message: 'Nose vector extracted successfully',
      };
    } catch (error) {
      // 이미 HttpException인 경우 그대로 throw
      if (error instanceof HttpException) {
        throw error;
      }

      // gRPC 연결 에러 처리
      if (error.code === 14 || error.code === 'UNAVAILABLE') {
        this.logger.error('gRPC connection error:', error);
        throw new HttpException(
          {
            success: false,
            errorCode: MLErrorCode.SERVICE_UNAVAILABLE,
            errorMessage: 'ML 서비스에 연결할 수 없습니다',
            retryable: true,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // 기타 예외
      this.logger.error('Error extracting nose vector:', error);
      throw new HttpException(
        {
          success: false,
          errorCode: MLErrorCode.INTERNAL_SERVER_ERROR,
          errorMessage: error.message || 'Failed to extract nose vector',
          retryable: true,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/nose-embedder/health
   * Check the health of the gRPC service
   */
  @Get('health')
  async healthCheck() {
    try {
      const health = await this.noseEmbedderService.healthCheck();

      return {
        status: health.status === 1 ? 'SERVING' : 'NOT_SERVING',
        message: health.message,
        modelLoaded: health.modelLoaded,
        timestamp: health.timestamp,
      };
    } catch (error) {
      console.error('Health check error:', error);
      return {
        status: 'ERROR',
        message: error.message || 'Failed to connect to gRPC service',
        modelLoaded: 'Unknown',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /api/nose-embedder/status
   * Simple status endpoint
   */
  @Get('status')
  getStatus() {
    return {
      service: 'Nose Embedder API Gateway',
      version: '1.0.0',
      grpcEndpoint: 'localhost:50052',
    };
  }
}

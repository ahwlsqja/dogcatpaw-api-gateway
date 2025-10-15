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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NoseEmbedderProxyService } from './nose-embedding.proxy.service';

@Controller('nose-embedder')
@ApiBearerAuth()
@ApiTags('Nose-Embedder')
export class NoseEmbedderController {
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
      console.error('Error extracting nose vector:', error);
      throw new HttpException(
        error.message || 'Failed to extract nose vector',
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

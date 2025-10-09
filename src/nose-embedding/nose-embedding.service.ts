// NestJS Service Example - gRPC Client
// Copy this to your NestJS project (e.g., src/nose-embedder/nose-embedder.service.ts)

import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  NoseImageRequest,
  NoseVectorResponse,
  HealthCheckRequest,
  HealthCheckResponse,
} from './dto/nose-embedder.dto';

@Injectable()
export class NoseEmbedderService implements OnModuleInit {
  private noseEmbedderService: any;

  constructor(
    @Inject('NOSE_EMBEDDER_PACKAGE') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    // Get the gRPC service
    this.grpcService = this.client.getService<INoseEmbedderService>(
      'NoseEmbedderService',
    );
  }

  /**
   * Extract nose vector from image
   * @param imageBuffer - Image file buffer
   * @param imageFormat - Optional image format (jpeg, png)
   */
  async extractNoseVector(
    imageBuffer: Buffer,
    imageFormat?: string,
  ): Promise<NoseVectorResponse> {
    const request: NoseImageRequest = {
      imageData: imageBuffer,
      imageFormat: imageFormat || 'jpeg',
    };

    try {
      // Convert Observable to Promise
      const response = await firstValueFrom(
        this.grpcService.extractNoseVector(request),
      );
      return response;
    } catch (error) {
      console.error('gRPC error:', error);
      throw new Error(`Failed to extract nose vector: ${error.message}`);
    }
  }

  /**
   * Check gRPC service health
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const request: HealthCheckRequest = {
      service: 'NoseEmbedderService',
    };

    try {
      const response = await firstValueFrom(
        this.grpcService.healthCheck(request),
      );
      return response;
    } catch (error) {
      console.error('Health check error:', error);
      throw new Error(`Health check failed: ${error.message}`);
    }
  }
}

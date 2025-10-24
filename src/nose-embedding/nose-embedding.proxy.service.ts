import { Injectable, OnModuleInit } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import {
  NoseVectorResponse,
  NoseVectorProtoResponse,
  NoseImageRequest,
  HealthCheckResponse,
  HealthCheckRequest,
  CompareVectorsResponse,
  CompareVectorsProtoResponse,
  CompareWithStoredImageRequest
} from './dto/nose-embedder.dto'
import { Inject } from "@nestjs/common";
import { protoEnumToMLErrorCode } from 'src/common/const/ml-error-codes';

@Injectable()
export class NoseEmbedderProxyService implements OnModuleInit {
    private noseEmbedderService: any;

    constructor(
        @Inject('NOSE_EMBEDDER_PACKAGE') private client: ClientGrpc,
    ) {}

    onModuleInit() {
        this.noseEmbedderService= this.client.getService('NoseEmbedderService');
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
      image_data: Array.from(imageBuffer),
      image_format: imageFormat || 'jpeg',
    };

    console.log(request)

    // Convert Observable to Promise - Proto response (snake_case)
    const protoResponse = await firstValueFrom<NoseVectorProtoResponse>(
        this.noseEmbedderService.extractNoseVector(request),
    );

    // Convert snake_case proto response to camelCase application response
    const response: NoseVectorResponse = {
      vector: protoResponse.vector,
      vectorSize: protoResponse.vector_size,
      success: protoResponse.success,
      errorMessage: protoResponse.error_message,
      retryable: protoResponse.retryable,
    };

    // Proto enum을 MLErrorCode로 변환
    if (!response.success && protoResponse.error_code !== undefined) {
      response.errorCode = protoEnumToMLErrorCode(protoResponse.error_code);
    }

    return response;
  }


    /**
   * Check gRPC service health
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const request: HealthCheckRequest = {
      service: 'NoseEmbedderService',
    };

    return firstValueFrom(
        this.noseEmbedderService.healthCheck(request)
    )
  }


  /**
  * Compare new image with stored vector
  * @param imagekey - New image file buffer
  * @param petDid - Pet DID to fetch stored vector from NCP
  */
  async compareWithStoredImage(
    imageKey: string,
    petDID: string,
  ): Promise<CompareVectorsResponse> {
    const request: CompareWithStoredImageRequest = {
      image_key: imageKey,
      pet_did: petDID,
    };

    // Convert Observable to Promise - Proto response (snake_case)
    const protoResponse = await firstValueFrom<CompareVectorsProtoResponse>(
      this.noseEmbedderService.compareWithStoredImage(request),
    );

    // Convert snake_case proto response to camelCase application response
    const response: CompareVectorsResponse = {
      similarity: protoResponse.similarity,
      cosine_similarity: protoResponse.cosine_similarity,
      euclidean_distance: protoResponse.euclidean_distance,
      vector_size: protoResponse.vector_size,
      success: protoResponse.success,
      errorMessage: protoResponse.error_message,
      retryable: protoResponse.retryable,
    };

    // Proto enum을 MLErrorCode로 변환
    if (!response.success && protoResponse.error_code !== undefined) {
      response.errorCode = protoEnumToMLErrorCode(protoResponse.error_code);
    }

    return response;
  }
}
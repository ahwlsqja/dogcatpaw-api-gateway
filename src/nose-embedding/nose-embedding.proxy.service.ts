import { Injectable, OnModuleInit } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { NoseVectorResponse, NoseImageRequest, HealthCheckResponse, HealthCheckRequest, CompareVectorsRequest, CompareVectorsResponse } from './dto/nose-embedder.dto'
import { Inject } from "@nestjs/common";

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

    // Convert Observable to Promise
    return firstValueFrom(
        this.noseEmbedderService.extractNoseVector(request),
        );
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
   * Compare two nose vectors for similarity
   * @param vector1 - First feature vector
   * @param vector2 - Second feature vector
   * @param petDID - Optional pet DID for logging
   */
  async compareVectors(
    vector1: number[],
    vector2: number[],
    petDID?: string
  ): Promise<CompareVectorsResponse> {
    const request: CompareVectorsRequest = {
      vector1,
      vector2,
      petDID,
    };

    console.log(`Comparing vectors for pet: ${petDID || 'unknown'}`);

    return firstValueFrom(
      this.noseEmbedderService.compareVectors(request)
    );
  }
}
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { NoseVectorResponse, NoseImageRequest, HealthCheckResponse, HealthCheckRequest, CompareVectorsResponse, CompareWithStoredImageRequest } from './dto/nose-embedder.dto'
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
    // Convert Observable to Promise
    return firstValueFrom(
        this.noseEmbedderService.compareWithStoredImage(request),
    );
  }
}
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { NoseVectorResponse, NoseImageRequest } from './dto/nose-embedder.dto'
import { Inject } from "@nestjs/common";

@Injectable()
export class NoseEmbedderService implements OnModuleInit {
    private noseEmbedderService: any;

    constructor(
        @Inject('NOSE_EMBEDDING_SERVICE') private client: ClientGrpc,
    ) {}

    onModuleInit() {
        this.noseEmbedderService= this.client.getService('NoseEmbedderService');
    }
t
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

    // Convert Observable to Promise
    return firstValueFrom(
        this.noseEmbedderService.extractNoseVector(request),
        );
    }
}
// api-gateway/src/vc/vc-proxy.service.ts
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

/**
 * VcProxyService 는 gRPC 클라이언트로서 VC 서비스와 통신함.
 */
@Injectable()
export class VcProxyService implements OnModuleInit {
  private vcService: any;

  constructor(
    @Inject('VC_GRPC_SERVICE') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.vcService = this.client.getService('VCService');
  }

  async storeVC(data: any) {
    return firstValueFrom(this.vcService.StoreVC(data));
  }

  async getVC(data: any) {
    return firstValueFrom(this.vcService.GetVC(data));
  }
}
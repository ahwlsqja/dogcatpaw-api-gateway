// api-gateway/src/vc/vc-proxy.service.ts
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  RegisterAuthRequestDto,
  RegisterAuthResponseDto,
  UpdateGuardianInfoRequestDto,
  UpdateGuardianInfoResponseDto,
  UpdateShelterInfoRequestDto,
  UpdateShelterInfoResponseDto,
  StoreVCRequestDto,
  StoreVCResponseDto,
  GetVCRequestDto,
  GetVCResponseDto,
  GetVCsByWalletRequestDto,
  GetVCsByWalletResponseDto,
  CheckAuthResponseDto,
  CheckAuthRequestDto,
  HealthCheckRequestDto,
  HealthCheckResponseDto,
} from './dto/grpc-vc-req.dto';

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

  async registerAuth(data: RegisterAuthRequestDto): Promise<RegisterAuthResponseDto> {
    return firstValueFrom(this.vcService.RegisterAuth(data));
  }

  async updateGuardianInfo(data: UpdateGuardianInfoRequestDto): Promise<UpdateGuardianInfoResponseDto> {
    return firstValueFrom(this.vcService.UpdateGuardianInfo(data));
  }

  async updateShelterInfo(data: UpdateShelterInfoRequestDto): Promise<UpdateShelterInfoResponseDto> {
    return firstValueFrom(this.vcService.UpdateShelterInfo(data));
  }

  async storeVC(data: StoreVCRequestDto): Promise<StoreVCResponseDto> {
    return firstValueFrom(this.vcService.StoreVC(data));
  }

  async getVC(data: GetVCRequestDto): Promise<GetVCResponseDto> {
    return firstValueFrom(this.vcService.GetVC(data));
  }

  async getVCsByWallet(data: GetVCsByWalletRequestDto): Promise<GetVCsByWalletResponseDto> {
    return firstValueFrom(this.vcService.GetVCsByWallet(data));
  }

  async checkAuth(data: CheckAuthRequestDto): Promise<CheckAuthResponseDto> {
    return firstValueFrom(this.vcService.CheckAuth(data));
  }

  async healthCheck(data: HealthCheckRequestDto): Promise<HealthCheckResponseDto> {
    return firstValueFrom(this.vcService.HealthCheck(data));
  }
}
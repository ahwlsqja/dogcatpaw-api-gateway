// api-gateway/src/faucet/faucet.proxy.service.ts
import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import {
  RequestFundsRequestDto,
  RequestFundsResponseDto,
  GetFaucetBalanceRequestDto,
  GetFaucetBalanceResponseDto,
  GetFaucetHistoryRequestDto,
  GetFaucetHistoryResponseDto,
  HealthCheckRequestDto,
  HealthCheckResponseDto,
} from './dto/grpc-faucet-req.dto';

interface FaucetGrpcService {
  requestFunds(data: RequestFundsRequestDto): Observable<RequestFundsResponseDto>;
  getFaucetBalance(data: GetFaucetBalanceRequestDto): Observable<GetFaucetBalanceResponseDto>;
  getFaucetHistory(data: GetFaucetHistoryRequestDto): Observable<GetFaucetHistoryResponseDto>;
  healthCheck(data: HealthCheckRequestDto): Observable<HealthCheckResponseDto>;
}

/**
 * FaucetProxyService는 gRPC 클라이언트로서 Faucet 서비스와 통신함.
 */
@Injectable()
export class FaucetProxyService implements OnModuleInit {
  private readonly logger = new Logger(FaucetProxyService.name);
  private faucetService: FaucetGrpcService;

  constructor(
    @Inject('FAUCET_GRPC_SERVICE') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.faucetService = this.client.getService<FaucetGrpcService>('FaucetService');
  }

  async requestFunds(walletAddress: string, amount?: string): Promise<RequestFundsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.faucetService.requestFunds({
          walletAddress,
          amount: amount || '100',
        }),
      );
      return result;
    } catch (error) {
      this.logger.error('Faucet requestFunds error:', error);
      throw error;
    }
  }

  async getFaucetBalance(walletAddress?: string): Promise<GetFaucetBalanceResponseDto> {
    try {
      const result = await firstValueFrom(
        this.faucetService.getFaucetBalance({
          walletAddress: walletAddress || '',
        }),
      );
      return result;
    } catch (error) {
      this.logger.error('Faucet getFaucetBalance error:', error);
      throw error;
    }
  }

  async getFaucetHistory(walletAddress?: string, limit?: number): Promise<GetFaucetHistoryResponseDto> {
    try {
      const result = await firstValueFrom(
        this.faucetService.getFaucetHistory({
          walletAddress: walletAddress || '',
          limit: limit || 10,
        }),
      );
      return result;
    } catch (error) {
      this.logger.error('Faucet getFaucetHistory error:', error);
      throw error;
    }
  }

  async healthCheck(service: string): Promise<HealthCheckResponseDto> {
    try {
      const result = await firstValueFrom(
        this.faucetService.healthCheck({ service }),
      );
      return result;
    } catch (error) {
      this.logger.error('Faucet healthCheck error:', error);
      throw error;
    }
  }
}

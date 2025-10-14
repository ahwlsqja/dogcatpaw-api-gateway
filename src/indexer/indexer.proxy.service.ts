// api-gateway/src/indexer/indexer.proxy.service.ts
import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  GetPetTransferHistoryRequestDto,
  GetPetTransferHistoryResponseDto,
  GetPetCurrentControllerRequestDto,
  GetPetCurrentControllerResponseDto,
  GetTransfersByControllerRequestDto,
  GetTransfersByControllerResponseDto,
  GetIndexerStatsRequestDto,
  GetIndexerStatsResponseDto,
  HealthCheckRequestDto,
  HealthCheckResponseDto,
} from './dto/indexer-grpc.dto';

interface IndexerGrpcService {
  GetPetTransferHistory(data: GetPetTransferHistoryRequestDto): any;
  GetPetCurrentController(data: GetPetCurrentControllerRequestDto): any;
  GetTransfersByController(data: GetTransfersByControllerRequestDto): any;
  GetIndexerStats(data: GetIndexerStatsRequestDto): any;
  HealthCheck(data: HealthCheckRequestDto): any;
}

/**
 * IndexerProxyService communicates with the blockchain-indexer gRPC service
 */
@Injectable()
export class IndexerProxyService implements OnModuleInit {
  private readonly logger = new Logger(IndexerProxyService.name);
  private indexerService: IndexerGrpcService;

  constructor(
    @Inject('INDEXER_GRPC_SERVICE') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.indexerService = this.client.getService<IndexerGrpcService>('IndexerService');
    this.logger.log('IndexerProxyService initialized');
  }

  async getPetTransferHistory(data: GetPetTransferHistoryRequestDto): Promise<GetPetTransferHistoryResponseDto> {
    try {
      return await firstValueFrom(this.indexerService.GetPetTransferHistory(data));
    } catch (error) {
      this.logger.error(`Error getting pet transfer history: ${error.message}`);
      return {
        success: false,
        petDID: data.petDID,
        totalTransfers: 0,
        history: [],
        error: error.message,
      };
    }
  }

  async getPetCurrentController(data: GetPetCurrentControllerRequestDto): Promise<GetPetCurrentControllerResponseDto> {
    try {
      return await firstValueFrom(this.indexerService.GetPetCurrentController(data));
    } catch (error) {
      this.logger.error(`Error getting pet current controller: ${error.message}`);
      return {
        success: false,
        petDID: data.petDID,
        totalTransfers: 0,
        error: error.message,
      };
    }
  }

  async getTransfersByController(data: GetTransfersByControllerRequestDto): Promise<GetTransfersByControllerResponseDto> {
    try {
      return await firstValueFrom(this.indexerService.GetTransfersByController(data));
    } catch (error) {
      this.logger.error(`Error getting transfers by controller: ${error.message}`);
      return {
        success: false,
        controllerAddress: data.controllerAddress,
        totalTransfers: 0,
        transfers: [],
        error: error.message,
      };
    }
  }

  async getIndexerStats(data: GetIndexerStatsRequestDto = {}): Promise<GetIndexerStatsResponseDto> {
    try {
      return await firstValueFrom(this.indexerService.GetIndexerStats(data));
    } catch (error) {
      this.logger.error(`Error getting indexer stats: ${error.message}`);
      return {
        success: false,
        totalPetsTracked: 0,
        totalTransfers: 0,
        lastIndexedBlock: 0,
        currentBlockNumber: 0,
        isSyncing: false,
        lastSyncTime: '',
        error: error.message,
      };
    }
  }

  async healthCheck(data: HealthCheckRequestDto = {}): Promise<HealthCheckResponseDto> {
    try {
      return await firstValueFrom(this.indexerService.HealthCheck(data));
    } catch (error) {
      this.logger.error(`Error checking indexer health: ${error.message}`);
      throw error;
    }
  }
}

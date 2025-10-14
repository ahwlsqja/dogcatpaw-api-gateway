// api-gateway/src/indexer/dto/indexer-grpc.dto.ts

export interface GetPetTransferHistoryRequestDto {
  petDID: string;
  limit?: number;
  offset?: number;
}

export interface GetPetTransferHistoryResponseDto {
  success: boolean;
  petDID: string;
  totalTransfers: number;
  history: TransferEventDto[];
  error?: string;
}

export interface TransferEventDto {
  petDID: string;
  previousController: string;
  newController: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  timestampISO: string;
  transferIndex: number;
}

export interface GetPetCurrentControllerRequestDto {
  petDID: string;
}

export interface GetPetCurrentControllerResponseDto {
  success: boolean;
  petDID: string;
  currentController?: string;
  lastTransferTimestamp?: number;
  lastTransferTimestampISO?: string;
  totalTransfers: number;
  error?: string;
}

export interface GetTransfersByControllerRequestDto {
  controllerAddress: string;
  limit?: number;
  offset?: number;
}

export interface GetTransfersByControllerResponseDto {
  success: boolean;
  controllerAddress: string;
  totalTransfers: number;
  transfers: TransferEventDto[];
  error?: string;
}

export interface GetIndexerStatsRequestDto {
  query?: string;
}

export interface GetIndexerStatsResponseDto {
  success: boolean;
  totalPetsTracked: number;
  totalTransfers: number;
  lastIndexedBlock: number;
  currentBlockNumber: number;
  isSyncing: boolean;
  lastSyncTime: string;
  error?: string;
}

export interface HealthCheckRequestDto {
  service?: string;
}

export enum ServingStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}

export interface HealthCheckResponseDto {
  status: ServingStatus;
  message: string;
  timestamp: string;
  version: string;
  databaseConnected: boolean;
  blockchainConnected: boolean;
}

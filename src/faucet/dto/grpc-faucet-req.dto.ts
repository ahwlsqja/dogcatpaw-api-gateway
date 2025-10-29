// api-gateway/src/faucet/dto/grpc-faucet-req.dto.ts
// Faucet gRPC 서비스와의 통신을 위한 DTO 정의

/**
 * RequestFunds 요청
 */
export interface RequestFundsRequestDto {
  walletAddress: string;
  amount?: string;
}

export interface RequestFundsData {
  transactionHash: string;
  walletAddress: string;
  amount: string;
  timestamp: string;
}

export interface RequestFundsResponseDto {
  success: boolean;
  data?: RequestFundsData;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
  message?: string;
}

/**
 * GetFaucetBalance 요청
 */
export interface GetFaucetBalanceRequestDto {
  walletAddress?: string;
}

export interface GetFaucetBalanceData {
  balance: string;
  address: string;
}

export interface GetFaucetBalanceResponseDto {
  success: boolean;
  data?: GetFaucetBalanceData;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
}

/**
 * GetFaucetHistory 요청
 */
export interface GetFaucetHistoryRequestDto {
  walletAddress?: string;
  limit?: number;
}

export interface FaucetTransaction {
  transactionHash: string;
  toAddress: string;
  amount: string;
  timestamp: string;
  status: string;
}

export interface GetFaucetHistoryData {
  transactions: FaucetTransaction[];
}

export interface GetFaucetHistoryResponseDto {
  success: boolean;
  data?: GetFaucetHistoryData;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
}

/**
 * HealthCheck 요청
 */
export interface HealthCheckRequestDto {
  service: string;
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
}

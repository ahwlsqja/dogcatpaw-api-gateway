// api-gateway/src/common/const/faucet-error-codes.ts
// Faucet 서버와 API Gateway 간 공통 에러 코드 정의

export enum FaucetErrorCode {
  // 4xxx: 재시도 불가능한 클라이언트 에러
  INVALID_ADDRESS = 'FAUCET_4001',
  AMOUNT_TOO_HIGH = 'FAUCET_4002',
  INVALID_REQUEST = 'FAUCET_4003',

  // 5xxx: 재시도 가능한 서버 에러
  COOLDOWN_ACTIVE = 'FAUCET_5001',
  TRANSACTION_FAILED = 'FAUCET_5002',
  BALANCE_CHECK_FAILED = 'FAUCET_5003',
  HISTORY_FETCH_FAILED = 'FAUCET_5004',
  WEB3_CONNECTION_ERROR = 'FAUCET_5005',
  GRPC_CONNECTION_ERROR = 'FAUCET_5006',
  INTERNAL_SERVER_ERROR = 'FAUCET_5007',
  SERVICE_UNAVAILABLE = 'FAUCET_5008',
}

export interface FaucetErrorResponse {
  success: false;
  errorCode: FaucetErrorCode;
  errorMessage: string;
  retryable: boolean;
  timestamp?: string;
}

export interface FaucetSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

export type FaucetResponse<T = any> = FaucetSuccessResponse<T> | FaucetErrorResponse;

/**
 * 에러 코드가 재시도 가능한지 판단
 */
export function isRetryableError(errorCode: FaucetErrorCode): boolean {
  return errorCode.startsWith('FAUCET_5');
}

/**
 * 에러 코드별 재시도 전략
 */
export const FaucetRetryStrategy = {
  [FaucetErrorCode.COOLDOWN_ACTIVE]: {
    attempts: 1,
    backoff: 'none' as const,
    delay: 0,
  },
  [FaucetErrorCode.TRANSACTION_FAILED]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
  [FaucetErrorCode.BALANCE_CHECK_FAILED]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [FaucetErrorCode.HISTORY_FETCH_FAILED]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [FaucetErrorCode.WEB3_CONNECTION_ERROR]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [FaucetErrorCode.GRPC_CONNECTION_ERROR]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [FaucetErrorCode.SERVICE_UNAVAILABLE]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [FaucetErrorCode.INTERNAL_SERVER_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
};

/**
 * 에러 코드별 설명
 */
export const FaucetErrorMessages = {
  [FaucetErrorCode.INVALID_ADDRESS]: '유효하지 않은 지갑 주소입니다.',
  [FaucetErrorCode.AMOUNT_TOO_HIGH]: '요청 금액이 최대 허용량을 초과했습니다.',
  [FaucetErrorCode.INVALID_REQUEST]: '잘못된 요청입니다.',
  [FaucetErrorCode.COOLDOWN_ACTIVE]: '쿨다운 기간이 활성화되어 있습니다. 잠시 후 다시 시도해주세요.',
  [FaucetErrorCode.TRANSACTION_FAILED]: '트랜잭션 실행에 실패했습니다.',
  [FaucetErrorCode.BALANCE_CHECK_FAILED]: '잔액 조회에 실패했습니다.',
  [FaucetErrorCode.HISTORY_FETCH_FAILED]: '거래 내역 조회에 실패했습니다.',
  [FaucetErrorCode.WEB3_CONNECTION_ERROR]: 'Web3 연결에 실패했습니다.',
  [FaucetErrorCode.GRPC_CONNECTION_ERROR]: 'gRPC 연결에 실패했습니다.',
  [FaucetErrorCode.INTERNAL_SERVER_ERROR]: '서버 내부 오류가 발생했습니다.',
  [FaucetErrorCode.SERVICE_UNAVAILABLE]: '서비스를 일시적으로 사용할 수 없습니다.',
};

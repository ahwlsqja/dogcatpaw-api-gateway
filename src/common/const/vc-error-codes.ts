// api-gateway/src/common/const/vc-error-codes.ts
// VC 서버와 API Gateway 간 공통 에러 코드 정의

export enum VCErrorCode {
  // 4xxx: 재시도 불가능한 클라이언트 에러
  WALLET_NOT_FOUND = 'VC_4001',
  WALLET_ALREADY_EXISTS = 'VC_4002',
  GUARDIAN_NOT_FOUND = 'VC_4003',
  VC_NOT_FOUND = 'VC_4004',
  INVALID_SIGNATURE = 'VC_4005',
  INVALID_REQUEST = 'VC_4006',
  UNAUTHORIZED = 'VC_4007',

  // 5xxx: 재시도 가능한 서버 에러
  DATABASE_ERROR = 'VC_5001',
  TRANSACTION_FAILED = 'VC_5002',
  GRPC_CONNECTION_ERROR = 'VC_5003',
  INTERNAL_SERVER_ERROR = 'VC_5004',
  SERVICE_UNAVAILABLE = 'VC_5005',
}

export interface VCErrorResponse {
  success: false;
  errorCode: VCErrorCode;
  errorMessage: string;
  retryable: boolean;
  timestamp?: string;
}

export interface VCSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

export type VCResponse<T = any> = VCSuccessResponse<T> | VCErrorResponse;

/**
 * 에러 코드가 재시도 가능한지 판단
 */
export function isRetryableError(errorCode: VCErrorCode): boolean {
  return errorCode.startsWith('VC_5');
}

/**
 * 에러 코드별 재시도 전략
 */
export const VCRetryStrategy = {
  [VCErrorCode.DATABASE_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
  [VCErrorCode.TRANSACTION_FAILED]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
  [VCErrorCode.GRPC_CONNECTION_ERROR]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [VCErrorCode.SERVICE_UNAVAILABLE]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [VCErrorCode.INTERNAL_SERVER_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
};

/**
 * 에러 코드별 설명
 */
export const VCErrorMessages = {
  [VCErrorCode.WALLET_NOT_FOUND]: '지갑이 존재하지 않습니다.',
  [VCErrorCode.WALLET_ALREADY_EXISTS]: '이미 등록된 지갑입니다.',
  [VCErrorCode.GUARDIAN_NOT_FOUND]: '가디언 정보가 존재하지 않습니다.',
  [VCErrorCode.VC_NOT_FOUND]: 'VC가 존재하지 않습니다.',
  [VCErrorCode.INVALID_SIGNATURE]: '유효하지 않은 서명입니다.',
  [VCErrorCode.INVALID_REQUEST]: '잘못된 요청입니다.',
  [VCErrorCode.UNAUTHORIZED]: '권한이 없습니다.',
  [VCErrorCode.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다.',
  [VCErrorCode.TRANSACTION_FAILED]: '트랜잭션 실행에 실패했습니다.',
  [VCErrorCode.GRPC_CONNECTION_ERROR]: 'gRPC 연결에 실패했습니다.',
  [VCErrorCode.INTERNAL_SERVER_ERROR]: '서버 내부 오류가 발생했습니다.',
  [VCErrorCode.SERVICE_UNAVAILABLE]: '서비스를 일시적으로 사용할 수 없습니다.',
};

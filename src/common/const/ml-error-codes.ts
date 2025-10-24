// api-gateway/src/common/const/ml-error-codes.ts
// ML 서버와 API Gateway 간 공통 에러 코드 정의

export enum MLErrorCode {
  // 4xxx: 재시도 불가능한 클라이언트 에러
  INVALID_IMAGE = 'ML_4001',
  IMAGE_TOO_LARGE = 'ML_4002',
  INVALID_IMAGE_FORMAT = 'ML_4003',
  VECTOR_NOT_FOUND = 'ML_4004',
  VECTOR_DIMENSION_MISMATCH = 'ML_4005',
  INVALID_REQUEST = 'ML_4006',

  // 5xxx: 재시도 가능한 서버 에러
  MODEL_NOT_LOADED = 'ML_5001',
  INFERENCE_ERROR = 'ML_5002',
  STORAGE_CONNECTION_ERROR = 'ML_5003',
  INTERNAL_SERVER_ERROR = 'ML_5004',
  SERVICE_UNAVAILABLE = 'ML_5005',
}

export interface MLErrorResponse {
  success: false;
  errorCode: MLErrorCode;
  errorMessage: string;
  retryable: boolean;
  timestamp?: string;
}

export interface MLSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

export type MLResponse<T = any> = MLSuccessResponse<T> | MLErrorResponse;

/**
 * 에러 코드가 재시도 가능한지 판단
 */
export function isRetryableError(errorCode: MLErrorCode): boolean {
  return errorCode.startsWith('ML_5');
}

/**
 * 에러 코드별 재시도 전략
 */
export const MLRetryStrategy = {
  [MLErrorCode.MODEL_NOT_LOADED]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
  [MLErrorCode.INFERENCE_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [MLErrorCode.STORAGE_CONNECTION_ERROR]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [MLErrorCode.INTERNAL_SERVER_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
  [MLErrorCode.SERVICE_UNAVAILABLE]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
};

/**
 * 에러 코드별 설명
 */
export const MLErrorMessages = {
  [MLErrorCode.INVALID_IMAGE]: '유효하지 않은 이미지입니다.',
  [MLErrorCode.IMAGE_TOO_LARGE]: '이미지 크기가 너무 큽니다.',
  [MLErrorCode.INVALID_IMAGE_FORMAT]: '지원하지 않는 이미지 형식입니다.',
  [MLErrorCode.VECTOR_NOT_FOUND]: '저장된 벡터를 찾을 수 없습니다.',
  [MLErrorCode.VECTOR_DIMENSION_MISMATCH]: '벡터 차원이 일치하지 않습니다.',
  [MLErrorCode.INVALID_REQUEST]: '잘못된 요청입니다.',
  [MLErrorCode.MODEL_NOT_LOADED]: 'ML 모델이 로드되지 않았습니다.',
  [MLErrorCode.INFERENCE_ERROR]: '추론 중 오류가 발생했습니다.',
  [MLErrorCode.STORAGE_CONNECTION_ERROR]: '스토리지 연결에 실패했습니다.',
  [MLErrorCode.INTERNAL_SERVER_ERROR]: 'ML 서버 내부 오류가 발생했습니다.',
  [MLErrorCode.SERVICE_UNAVAILABLE]: 'ML 서비스를 일시적으로 사용할 수 없습니다.',
};

/**
 * Proto enum 값을 MLErrorCode로 변환
 */
export function protoEnumToMLErrorCode(protoEnum: number): MLErrorCode {
  const mapping: Record<number, MLErrorCode> = {
    0: MLErrorCode.INVALID_IMAGE,
    1: MLErrorCode.IMAGE_TOO_LARGE,
    2: MLErrorCode.INVALID_IMAGE_FORMAT,
    3: MLErrorCode.VECTOR_NOT_FOUND,
    4: MLErrorCode.VECTOR_DIMENSION_MISMATCH,
    5: MLErrorCode.INVALID_REQUEST,
    6: MLErrorCode.MODEL_NOT_LOADED,
    7: MLErrorCode.INFERENCE_ERROR,
    8: MLErrorCode.STORAGE_CONNECTION_ERROR,
    9: MLErrorCode.INTERNAL_SERVER_ERROR,
    10: MLErrorCode.SERVICE_UNAVAILABLE,
  };

  return mapping[protoEnum] || MLErrorCode.INTERNAL_SERVER_ERROR;
}

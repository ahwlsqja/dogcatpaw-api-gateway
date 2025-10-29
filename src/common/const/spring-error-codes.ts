// api-gateway/src/common/const/spring-error-codes.ts
// Spring 서버와 API Gateway 간 공통 에러 코드 정의

export enum SpringErrorCode {
  // 4xxx: 재시도 불가능한 클라이언트 에러
  BAD_REQUEST = 'SPRING_4000',
  UNAUTHORIZED = 'SPRING_4001',
  FORBIDDEN = 'SPRING_4003',
  NOT_FOUND = 'SPRING_4004',
  CONFLICT = 'SPRING_4009',
  VALIDATION_ERROR = 'SPRING_4022',

  // User/Member Errors
  USER_NOT_FOUND = 'SPRING_4101',
  USER_ALREADY_EXISTS = 'SPRING_4102',
  INVALID_USER_DATA = 'SPRING_4103',

  // Pet Errors
  PET_NOT_FOUND = 'SPRING_4201',
  PET_ALREADY_REGISTERED = 'SPRING_4202',
  PET_NOT_OWNED_BY_USER = 'SPRING_4203',

  // Adoption Errors
  ADOPTION_NOT_FOUND = 'SPRING_4301',
  ADOPTION_ALREADY_CLOSED = 'SPRING_4302',
  ADOPTION_NOT_AUTHORIZED = 'SPRING_4303',

  // Story Errors
  STORY_NOT_FOUND = 'SPRING_4401',
  STORY_NOT_AUTHORIZED = 'SPRING_4402',

  // Chat Errors
  CHAT_ROOM_NOT_FOUND = 'SPRING_4501',
  CHAT_NOT_PARTICIPANT = 'SPRING_4502',
  CHAT_ROOM_ALREADY_EXISTS = 'SPRING_4503',

  // Donation Errors
  DONATION_NOT_FOUND = 'SPRING_4601',
  INSUFFICIENT_BONES = 'SPRING_4602',
  DONATION_CLOSED = 'SPRING_4603',

  // Payment Errors
  PAYMENT_NOT_FOUND = 'SPRING_4701',
  PAYMENT_ALREADY_APPROVED = 'SPRING_4702',
  PAYMENT_AMOUNT_MISMATCH = 'SPRING_4703',
  PAYMENT_VERIFICATION_FAILED = 'SPRING_4704',
  INVALID_PAYMENT_KEY = 'SPRING_4705',

  // 5xxx: 재시도 가능한 서버 에러
  INTERNAL_SERVER_ERROR = 'SPRING_5000',
  SERVICE_UNAVAILABLE = 'SPRING_5003',
  GATEWAY_TIMEOUT = 'SPRING_5004',

  // Database Errors
  DATABASE_ERROR = 'SPRING_5101',
  DATABASE_CONNECTION_ERROR = 'SPRING_5102',
  TRANSACTION_FAILED = 'SPRING_5103',

  // External Service Errors
  HTTP_CONNECTION_ERROR = 'SPRING_5201',
  HTTP_TIMEOUT = 'SPRING_5202',
  REDIS_CONNECTION_ERROR = 'SPRING_5203',

  // Payment Gateway Errors (retryable)
  PAYMENT_GATEWAY_ERROR = 'SPRING_5301',
  PAYMENT_GATEWAY_TIMEOUT = 'SPRING_5302',

  // S3/Storage Errors
  STORAGE_ERROR = 'SPRING_5401',
  STORAGE_UPLOAD_FAILED = 'SPRING_5402',
}

export interface SpringErrorResponse {
  success: false;
  errorCode: SpringErrorCode;
  errorMessage: string;
  retryable: boolean;
  timestamp?: string;
  statusCode?: number;
  path?: string;
}

export interface SpringSuccessResponse<T = any> {
  success: true;
  data?: T;
  result?: T;
  message?: string;
}

export type SpringResponse<T = any> = SpringSuccessResponse<T> | SpringErrorResponse;

/**
 * HTTP 상태 코드를 Spring 에러 코드로 매핑
 */
export function mapHttpStatusToSpringError(statusCode: number, endpoint?: string): SpringErrorCode {
  switch (statusCode) {
    case 400:
      return SpringErrorCode.BAD_REQUEST;
    case 401:
      return SpringErrorCode.UNAUTHORIZED;
    case 403:
      return SpringErrorCode.FORBIDDEN;
    case 404:
      // Endpoint별로 더 구체적인 에러 코드 반환
      if (endpoint?.includes('/api/pet')) return SpringErrorCode.PET_NOT_FOUND;
      if (endpoint?.includes('/api/adoption')) return SpringErrorCode.ADOPTION_NOT_FOUND;
      if (endpoint?.includes('/api/story')) return SpringErrorCode.STORY_NOT_FOUND;
      if (endpoint?.includes('/api/chat')) return SpringErrorCode.CHAT_ROOM_NOT_FOUND;
      if (endpoint?.includes('/api/donation')) return SpringErrorCode.DONATION_NOT_FOUND;
      if (endpoint?.includes('/api/payment')) return SpringErrorCode.PAYMENT_NOT_FOUND;
      return SpringErrorCode.NOT_FOUND;
    case 409:
      return SpringErrorCode.CONFLICT;
    case 422:
      return SpringErrorCode.VALIDATION_ERROR;
    case 500:
      return SpringErrorCode.INTERNAL_SERVER_ERROR;
    case 503:
      return SpringErrorCode.SERVICE_UNAVAILABLE;
    case 504:
      return SpringErrorCode.GATEWAY_TIMEOUT;
    default:
      if (statusCode >= 500) {
        return SpringErrorCode.INTERNAL_SERVER_ERROR;
      }
      return SpringErrorCode.BAD_REQUEST;
  }
}

/**
 * 에러 코드가 재시도 가능한지 판단
 */
export function isRetryableError(errorCode: SpringErrorCode): boolean {
  return errorCode.startsWith('SPRING_5');
}

/**
 * HTTP 상태 코드가 재시도 가능한 에러인지 판단
 */
export function isRetryableHttpStatus(statusCode: number): boolean {
  // 5xx 서버 에러는 재시도 가능
  // 408 (Request Timeout), 429 (Too Many Requests)도 재시도 가능
  return statusCode >= 500 || statusCode === 408 || statusCode === 429;
}

/**
 * 에러 코드별 재시도 전략
 */
export const SpringRetryStrategy = {
  // Database Errors
  [SpringErrorCode.DATABASE_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
  [SpringErrorCode.DATABASE_CONNECTION_ERROR]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [SpringErrorCode.TRANSACTION_FAILED]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },

  // Service Errors
  [SpringErrorCode.INTERNAL_SERVER_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
  [SpringErrorCode.SERVICE_UNAVAILABLE]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [SpringErrorCode.GATEWAY_TIMEOUT]: {
    attempts: 3,
    backoff: 'linear' as const,
    delay: 3000,
  },

  // HTTP Connection Errors
  [SpringErrorCode.HTTP_CONNECTION_ERROR]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [SpringErrorCode.HTTP_TIMEOUT]: {
    attempts: 3,
    backoff: 'linear' as const,
    delay: 3000,
  },

  // Redis Errors
  [SpringErrorCode.REDIS_CONNECTION_ERROR]: {
    attempts: 5,
    backoff: 'exponential' as const,
    delay: 500,
  },

  // Payment Gateway Errors
  [SpringErrorCode.PAYMENT_GATEWAY_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
  [SpringErrorCode.PAYMENT_GATEWAY_TIMEOUT]: {
    attempts: 3,
    backoff: 'linear' as const,
    delay: 5000,
  },

  // Storage Errors
  [SpringErrorCode.STORAGE_ERROR]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 1000,
  },
  [SpringErrorCode.STORAGE_UPLOAD_FAILED]: {
    attempts: 3,
    backoff: 'exponential' as const,
    delay: 2000,
  },
};

/**
 * 에러 코드별 설명 (한국어)
 */
export const SpringErrorMessages = {
  // Client Errors (4xxx)
  [SpringErrorCode.BAD_REQUEST]: '잘못된 요청입니다.',
  [SpringErrorCode.UNAUTHORIZED]: '인증이 필요합니다.',
  [SpringErrorCode.FORBIDDEN]: '접근 권한이 없습니다.',
  [SpringErrorCode.NOT_FOUND]: '요청한 리소스를 찾을 수 없습니다.',
  [SpringErrorCode.CONFLICT]: '요청이 현재 서버 상태와 충돌합니다.',
  [SpringErrorCode.VALIDATION_ERROR]: '입력값 검증에 실패했습니다.',

  // User/Member Errors
  [SpringErrorCode.USER_NOT_FOUND]: '사용자를 찾을 수 없습니다.',
  [SpringErrorCode.USER_ALREADY_EXISTS]: '이미 등록된 사용자입니다.',
  [SpringErrorCode.INVALID_USER_DATA]: '유효하지 않은 사용자 정보입니다.',

  // Pet Errors
  [SpringErrorCode.PET_NOT_FOUND]: '반려동물을 찾을 수 없습니다.',
  [SpringErrorCode.PET_ALREADY_REGISTERED]: '이미 등록된 반려동물입니다.',
  [SpringErrorCode.PET_NOT_OWNED_BY_USER]: '반려동물의 소유자가 아닙니다.',

  // Adoption Errors
  [SpringErrorCode.ADOPTION_NOT_FOUND]: '입양 공고를 찾을 수 없습니다.',
  [SpringErrorCode.ADOPTION_ALREADY_CLOSED]: '이미 종료된 입양 공고입니다.',
  [SpringErrorCode.ADOPTION_NOT_AUTHORIZED]: '입양 공고에 대한 권한이 없습니다.',

  // Story Errors
  [SpringErrorCode.STORY_NOT_FOUND]: '스토리를 찾을 수 없습니다.',
  [SpringErrorCode.STORY_NOT_AUTHORIZED]: '스토리에 대한 권한이 없습니다.',

  // Chat Errors
  [SpringErrorCode.CHAT_ROOM_NOT_FOUND]: '채팅방을 찾을 수 없습니다.',
  [SpringErrorCode.CHAT_NOT_PARTICIPANT]: '채팅방 참여자가 아닙니다.',
  [SpringErrorCode.CHAT_ROOM_ALREADY_EXISTS]: '이미 존재하는 채팅방입니다.',

  // Donation Errors
  [SpringErrorCode.DONATION_NOT_FOUND]: '후원 캠페인을 찾을 수 없습니다.',
  [SpringErrorCode.INSUFFICIENT_BONES]: '뼈다귀가 부족합니다.',
  [SpringErrorCode.DONATION_CLOSED]: '종료된 후원 캠페인입니다.',

  // Payment Errors
  [SpringErrorCode.PAYMENT_NOT_FOUND]: '결제 정보를 찾을 수 없습니다.',
  [SpringErrorCode.PAYMENT_ALREADY_APPROVED]: '이미 승인된 결제입니다.',
  [SpringErrorCode.PAYMENT_AMOUNT_MISMATCH]: '결제 금액이 일치하지 않습니다.',
  [SpringErrorCode.PAYMENT_VERIFICATION_FAILED]: '결제 검증에 실패했습니다.',
  [SpringErrorCode.INVALID_PAYMENT_KEY]: '유효하지 않은 결제 키입니다.',

  // Server Errors (5xxx)
  [SpringErrorCode.INTERNAL_SERVER_ERROR]: '서버 내부 오류가 발생했습니다.',
  [SpringErrorCode.SERVICE_UNAVAILABLE]: '서비스를 일시적으로 사용할 수 없습니다.',
  [SpringErrorCode.GATEWAY_TIMEOUT]: '게이트웨이 응답 시간이 초과되었습니다.',

  // Database Errors
  [SpringErrorCode.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다.',
  [SpringErrorCode.DATABASE_CONNECTION_ERROR]: '데이터베이스 연결에 실패했습니다.',
  [SpringErrorCode.TRANSACTION_FAILED]: '트랜잭션 실행에 실패했습니다.',

  // External Service Errors
  [SpringErrorCode.HTTP_CONNECTION_ERROR]: 'HTTP 연결에 실패했습니다.',
  [SpringErrorCode.HTTP_TIMEOUT]: 'HTTP 요청 시간이 초과되었습니다.',
  [SpringErrorCode.REDIS_CONNECTION_ERROR]: 'Redis 연결에 실패했습니다.',

  // Payment Gateway Errors
  [SpringErrorCode.PAYMENT_GATEWAY_ERROR]: '결제 게이트웨이 오류가 발생했습니다.',
  [SpringErrorCode.PAYMENT_GATEWAY_TIMEOUT]: '결제 게이트웨이 응답 시간이 초과되었습니다.',

  // Storage Errors
  [SpringErrorCode.STORAGE_ERROR]: '스토리지 오류가 발생했습니다.',
  [SpringErrorCode.STORAGE_UPLOAD_FAILED]: '파일 업로드에 실패했습니다.',
};

/**
 * Spring 에러 응답 생성 헬퍼
 */
export function createSpringErrorResponse(
  errorCode: SpringErrorCode,
  customMessage?: string,
  statusCode?: number
): SpringErrorResponse {
  return {
    success: false,
    errorCode,
    errorMessage: customMessage || SpringErrorMessages[errorCode],
    retryable: isRetryableError(errorCode),
    timestamp: new Date().toISOString(),
    statusCode: statusCode,
  };
}

/**
 * Axios 에러를 Spring 에러로 변환
 */
export function parseAxiosError(error: any, endpoint?: string): SpringErrorResponse {
  // Axios HTTP 에러 응답
  if (error.response) {
    const statusCode = error.response.status;
    const errorCode = mapHttpStatusToSpringError(statusCode, endpoint);

    // Spring 백엔드에서 에러 메시지가 있으면 사용
    const message = error.response.data?.message ||
                   error.response.data?.error ||
                   SpringErrorMessages[errorCode];

    return createSpringErrorResponse(errorCode, message, statusCode);
  }

  // 네트워크 연결 에러
  if (error.request) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return createSpringErrorResponse(
        SpringErrorCode.HTTP_CONNECTION_ERROR,
        '서버에 연결할 수 없습니다.',
        503
      );
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return createSpringErrorResponse(
        SpringErrorCode.HTTP_TIMEOUT,
        '요청 시간이 초과되었습니다.',
        504
      );
    }

    return createSpringErrorResponse(
      SpringErrorCode.HTTP_CONNECTION_ERROR,
      error.message,
      503
    );
  }

  // 기타 에러
  return createSpringErrorResponse(
    SpringErrorCode.INTERNAL_SERVER_ERROR,
    error.message || '알 수 없는 오류가 발생했습니다.',
    500
  );
}

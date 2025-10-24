// api-gateway/src/common/const/blockchain-error-codes.ts
// 블록체인 트랜잭션 에러 코드 정의

export enum BlockchainErrorCode {
  // 4xxx: 사용자 에러 (재시도 불가)
  PET_ALREADY_REGISTERED = 'BC_4001',
  GUARDIAN_ALREADY_REGISTERED = 'BC_4002',
  NOT_AUTHORIZED = 'BC_4003',
  INVALID_TRANSACTION = 'BC_4004',
  INSUFFICIENT_GAS = 'BC_4005',
  NONCE_TOO_LOW = 'BC_4006',

  // 5xxx: 네트워크/서버 에러 (재시도 가능)
  NETWORK_ERROR = 'BC_5001',
  RPC_ERROR = 'BC_5002',
  TIMEOUT = 'BC_5003',
  UNKNOWN_ERROR = 'BC_5004',
}

export interface BlockchainErrorResponse {
  success: false;
  errorCode: BlockchainErrorCode;
  errorMessage: string;
  retryable: boolean;
  txHash?: string;
  blockNumber?: number;
  details?: any;
}

export interface BlockchainSuccessResponse {
  success: true;
  txHash: string;
  blockNumber: number;
  gasUsed?: string;
}

export type BlockchainResponse = BlockchainSuccessResponse | BlockchainErrorResponse;

/**
 * 블록체인 에러 메시지
 */
export const BlockchainErrorMessages = {
  [BlockchainErrorCode.PET_ALREADY_REGISTERED]: '이미 등록된 펫입니다.',
  [BlockchainErrorCode.GUARDIAN_ALREADY_REGISTERED]: '이미 등록된 가디언입니다.',
  [BlockchainErrorCode.NOT_AUTHORIZED]: '권한이 없습니다.',
  [BlockchainErrorCode.INVALID_TRANSACTION]: '잘못된 트랜잭션입니다.',
  [BlockchainErrorCode.INSUFFICIENT_GAS]: '가스가 부족합니다.',
  [BlockchainErrorCode.NONCE_TOO_LOW]: 'Nonce가 너무 낮습니다.',
  [BlockchainErrorCode.NETWORK_ERROR]: '네트워크 오류가 발생했습니다.',
  [BlockchainErrorCode.RPC_ERROR]: 'RPC 서버 오류가 발생했습니다.',
  [BlockchainErrorCode.TIMEOUT]: '트랜잭션 타임아웃이 발생했습니다.',
  [BlockchainErrorCode.UNKNOWN_ERROR]: '알 수 없는 오류가 발생했습니다.',
};

/**
 * ethers 에러를 BlockchainErrorCode로 분류
 */
export function classifyBlockchainError(error: any): {
  errorCode: BlockchainErrorCode;
  errorMessage: string;
  retryable: boolean;
} {
  // Transaction reverted (status: 0)
  if (error.code === 'CALL_EXCEPTION' && error.receipt?.status === 0) {
    // logs 배열이 비어있으면 revert (이벤트 없음 = 실패)
    // 일반적인 revert 원인들을 추측

    // 1. PetDID already exists
    if (error.transaction?.to?.toLowerCase().includes('petdid') ||
        error.message?.includes('Pet') ||
        error.message?.includes('already')) {
      return {
        errorCode: BlockchainErrorCode.PET_ALREADY_REGISTERED,
        errorMessage: '이미 등록된 펫입니다. 블록체인에서 중복 등록이 거부되었습니다.',
        retryable: false,
      };
    }

    // 2. Guardian already exists
    if (error.transaction?.to?.toLowerCase().includes('guardian') ||
        error.message?.includes('Guardian')) {
      return {
        errorCode: BlockchainErrorCode.GUARDIAN_ALREADY_REGISTERED,
        errorMessage: '이미 등록된 가디언입니다. 블록체인에서 중복 등록이 거부되었습니다.',
        retryable: false,
      };
    }

    // 3. Not authorized
    if (error.message?.includes('authorized') ||
        error.message?.includes('permission') ||
        error.message?.includes('owner')) {
      return {
        errorCode: BlockchainErrorCode.NOT_AUTHORIZED,
        errorMessage: '권한이 없습니다. 이 작업을 수행할 수 있는 권한이 없습니다.',
        retryable: false,
      };
    }

    // 일반적인 revert
    return {
      errorCode: BlockchainErrorCode.INVALID_TRANSACTION,
      errorMessage: '트랜잭션이 블록체인에서 거부되었습니다. 이미 등록되었거나 조건을 만족하지 않습니다.',
      retryable: false,
    };
  }

  // Insufficient gas
  if (error.code === 'INSUFFICIENT_FUNDS' || error.message?.includes('gas')) {
    return {
      errorCode: BlockchainErrorCode.INSUFFICIENT_GAS,
      errorMessage: '가스가 부족합니다.',
      retryable: false,
    };
  }

  // Nonce too low
  if (error.code === 'NONCE_EXPIRED' || error.message?.includes('nonce')) {
    return {
      errorCode: BlockchainErrorCode.NONCE_TOO_LOW,
      errorMessage: 'Nonce가 너무 낮습니다. 트랜잭션을 다시 시도해주세요.',
      retryable: true,
    };
  }

  // Network errors
  if (error.code === 'NETWORK_ERROR' ||
      error.code === 'SERVER_ERROR' ||
      error.message?.includes('network') ||
      error.message?.includes('connection')) {
    return {
      errorCode: BlockchainErrorCode.NETWORK_ERROR,
      errorMessage: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
    };
  }

  // RPC errors
  if (error.message?.includes('RPC') || error.message?.includes('provider')) {
    return {
      errorCode: BlockchainErrorCode.RPC_ERROR,
      errorMessage: 'RPC 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
    };
  }

  // Timeout
  if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
    return {
      errorCode: BlockchainErrorCode.TIMEOUT,
      errorMessage: '트랜잭션 타임아웃이 발생했습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
    };
  }

  // Unknown error
  return {
    errorCode: BlockchainErrorCode.UNKNOWN_ERROR,
    errorMessage: error.message || '알 수 없는 오류가 발생했습니다.',
    retryable: false,
  };
}

/**
 * 블록체인 에러 응답 생성
 */
export function createBlockchainErrorResponse(
  error: any
): BlockchainErrorResponse {
  const classified = classifyBlockchainError(error);

  return {
    success: false,
    errorCode: classified.errorCode,
    errorMessage: classified.errorMessage,
    retryable: classified.retryable,
    txHash: error.receipt?.hash || error.transaction?.hash,
    blockNumber: error.receipt?.blockNumber,
    details: {
      code: error.code,
      reason: error.reason,
      status: error.receipt?.status,
    },
  };
}

// api-gateway/src/vc/dto/grpc-request.dto.ts

// Auth 관련 DTO
export class RegisterAuthRequestDto {
  walletAddress: string;
}

export class CheckAuthRequestDto {
  walletAddress: string;
}

export class RegisterAuthResponseDto {
  success: boolean;
  data?: {
    authId?: number;
  };
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
  message?: string;
}

export class GetGuardianInfoResponseDto{
  success: boolean;
  data?: {
    guardianId?: number;
    email?: string;
    phone?: string;
    name?: string;
    isEmailVerified?: boolean;
    isOnChainRegistered?: boolean;
  };
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
}

export class GetGuardianInfoRequestDto{
  walletAddress: string;
}

export class CheckAuthResponseDto {
  success: boolean;
  data?: {
    authId?: number;
  };
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
  message?: string;
}

// Guardian 관련 DTO
export class UpdateGuardianInfoRequestDto {
  walletAddress: string;
  email?: string;
  phone?: string;
  name?: string;
  isEmailVerified?: boolean;
  isOnChainRegistered?: boolean
}

export class UpdateGuardianInfoResponseDto {
  success: boolean;
  data?: {
    guardianId?: number;
  };
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
  message?: string;
}

// Shelter 관련 DTO
export class UpdateShelterInfoRequestDto {
  walletAddress: string;
  name?: string;
  location?: string;
  licenseNumber?: string;
  capacity?: number;
}

export class UpdateShelterInfoResponseDto {
  success: boolean;
  data?: {
    shelterId?: number;
  };
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
  message?: string;
}

// VC 관련 DTO
export class StoreVCRequestDto {
  guardianAddress: string;
  petDID: string;
  vcJwt: string;
  metadata?: string;
}

export class StoreVCResponseDto {
  success: boolean;
  data?: {
    vcId?: number;
  };
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
  message?: string;
}

export class GetVCRequestDto {
  petDID: string;
  guardianAddress: string;
}

export class GetVCResponseDto {
  success: boolean;
  data?: {
    vcJwt?: string;
    metadata?: string;
    createdAt?: string;
  };
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
}

export class GetVCsByWalletRequestDto {
  walletAddress: string;
}

export class VCDto {
  petDID: string;
  vcJwt: string;
  vcType: string;
  createdAt: string;
}

export class GetVCsByWalletResponseDto {
  success: boolean;
  data?: {
    vcs?: VCDto[];
  };
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
}

// InvalidateVC DTO
export class InvalidateVCRequestDto {
  petDID: string;
  guardianAddress: string;
  reason: string;
}

export class InvalidateVCResponseDto {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  timestamp?: string;
  message?: string;
}

// Health Check DTO
export class HealthCheckRequestDto {
  service?: string;
}

export enum ServingStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}

export class HealthCheckResponseDto {
  status: ServingStatus;
  message?: string;
  timestamp?: string;
  version?: string;
}
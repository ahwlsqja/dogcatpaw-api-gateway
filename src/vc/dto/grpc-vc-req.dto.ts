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
  authId?: number;
  message?: string;
  error?: string;
}

export class GetGuardianInfoResponseDto{
  success: boolean;
  guardianId: number;
  email: string;
  phone: string;
  name: string;
  isEmailVerified: boolean;
  isOnChainRegistered: boolean;
  error?: string;
}
  
export class GetGuardianInfoRequestDto{
  walletAddress: string;
}

export class CheckAuthResponseDto {
  success: boolean;
  authId?: number;
  message?: string;
  error?: string;
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
  guardianId?: number;
  message?: string;
  error?: string;
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
  shelterId?: number;
  message?: string;
  error?: string;
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
  vcId?: number;
  message?: string;
  error?: string;
}

export class GetVCRequestDto {
  petDID: string;
  guardianAddress: string;
}

export class GetVCResponseDto {
  success: boolean;
  vcJwt?: string;
  metadata?: string;
  createdAt?: string;
  error?: string;
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
  vcs?: VCDto[];
  error?: string;
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
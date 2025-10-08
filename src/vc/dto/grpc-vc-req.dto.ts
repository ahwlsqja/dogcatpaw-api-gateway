// api-gateway/src/vc/dto/grpc-request.dto.ts

// Auth 관련 DTO
export class RegisterAuthRequestDto {
  walletAddress: string;
}

export class RegisterAuthResponseDto {
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
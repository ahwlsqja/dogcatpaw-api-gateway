// api-gateway/src/vc/dto/get-vc.dto.ts
export class GetVCDto {
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
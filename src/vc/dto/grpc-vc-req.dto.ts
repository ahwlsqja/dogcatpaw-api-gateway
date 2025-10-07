// api-gateway/src/vc/dto/grpc-request.dto.ts
export class StoreVCRequestDto {
  guardianAddress: string;
  petDID: string;
  vcJwt: string;
  metadata: any;
}

export class GetVCRequestDto {
  petDID: string;
  guardianAddress: string;
}

export class GetVCsByWalletRequestDto {
  walletAddress: string;
}
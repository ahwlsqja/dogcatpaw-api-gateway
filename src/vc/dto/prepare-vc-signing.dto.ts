// api-gateway/src/vc/dto/prepare-signing.dto.ts
import { IsString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PetDataDto } from './pet-data.dto';

export class PrepareVCSigningDto {
  @IsString()
  @IsNotEmpty()
  petDID: string;

  @IsString()
  @IsNotEmpty()
  biometricHash: string;

  @ValidateNested()
  @Type(() => PetDataDto)
  petData: PetDataDto;
}

export class PrepareVCSigningResponseDto {
  message: {
    vcType: string;
    sub: string;
    guardian: string;
    biometricHash: string;
    petData: PetDataDto;
    issuedAt: string;
    nonce: string;
  };
  messageHash: string;
  instruction: string;
}
import { IsString, IsNotEmpty, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { PetDataDto } from './pet-data.dto';

export class CreateVCWithSignatureDto {
  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsObject()
  @IsNotEmpty()
  message: any; // 서명된 원본 메시지

  @IsString()
  @IsNotEmpty()
  petDID: string;

  @ValidateNested()
  @Type(() => PetDataDto)
  petData: PetDataDto;
}

export class CreateVCResponseDto {
  success: boolean;
  vcId?: number;
  message?: string;
  error?: string;
}
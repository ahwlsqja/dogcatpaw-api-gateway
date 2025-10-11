import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress, IsOptional, IsString, IsObject, IsNumber } from 'class-validator';
import { PetDataDto } from 'src/vc/dto/pet-data.dto';

export class PrepareTransferDto {
  @ApiProperty({
    description: '새로운 보호자 주소',
    example: '0x1234567890123456789012345678901234567890'
  })
  @IsEthereumAddress()
  newGuardianAddress: string;

  @ApiProperty({
    description: '펫 데이터',
    type: PetDataDto
  })
  @IsObject()
  petData: PetDataDto;
}

export class AcceptTransferDto {
  @ApiProperty({
    description: '서명',
    example: '0x...'
  })
  @IsString()
  signature: string;

  @ApiProperty({
    description: '서명할 메시지 (contains featureVector)'
  })
  @IsObject()
  message: any;

  @ApiProperty({
    description: '펫 데이터',
    type: PetDataDto
  })
  @IsObject()
  petData: PetDataDto;

  @ApiProperty({
    description: '비문 검증 증명'
  })
  @IsObject()
  verificationProof: any;

  @ApiPropertyOptional({
    description: '서명된 트랜잭션 (프로덕션 모드)',
    example: '0x...'
  })
  @IsOptional()
  @IsString()
  signedTx?: string;
}

export class VerifyTransferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({
    description: '유사도 (0-100)',
    example: 85
  })
  @IsNumber()
  similarity: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  verificationProof?: any;

  @ApiPropertyOptional()
  proofHash?: string;


  @ApiPropertyOptional()
  nextStep?: string;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  threshold?: number;
}

export class TransferPetResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  txHash: string;

  @ApiProperty()
  blockNumber: number;

  @ApiProperty()
  similarity: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  error?: string;
}
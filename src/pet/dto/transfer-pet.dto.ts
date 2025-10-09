import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress, IsOptional, IsString } from 'class-validator';

export class TransferPetDto {
  @ApiProperty({
    description: '새로운 컨트롤러 (보호자) 주소',
    example: '0x1234567890123456789012345678901234567890'
  })
  @IsEthereumAddress()
  newController: string;

  @ApiPropertyOptional({
    description: '서명된 트랜잭션 (프로덕션 모드)',
    example: '0x...'
  })
  @IsOptional()
  @IsString()
  signedTx?: string;

  @ApiPropertyOptional({
    description: '이전 사유',
    example: 'Adoption'
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransferPetResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  txHash: string;

  @ApiProperty()
  blockNumber: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  error?: string;
}
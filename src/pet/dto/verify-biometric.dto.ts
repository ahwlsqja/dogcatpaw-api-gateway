import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, Min, Max } from 'class-validator';

export class VerifyBiometricDto {
  @ApiProperty({
    description: '비문 유사도 (0-100)',
    example: 95,
    minimum: 0,
    maximum: 100
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  similarity: number;

  @ApiProperty({
    description: '검증 목적 (0: 인증, 1: 식별, 2: 등록)',
    example: 0,
    enum: [0, 1, 2]
  })
  @IsNumber()
  @Min(0)
  @Max(2)
  purpose: number;

  @ApiProperty({
    description: 'ML 모델 서버 서명',
    example: '0x...'
  })
  @IsString()
  modelServerSignature: string;
}

export class VerifyBiometricResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  isValid: boolean;

  @ApiProperty()
  petDID: string;

  @ApiProperty()
  similarity: number;

  @ApiProperty()
  purpose: number;

  @ApiPropertyOptional()
  message?: string;
}
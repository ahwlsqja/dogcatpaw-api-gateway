import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsObject, Min, Max } from 'class-validator';

export class CreatePetDto {
  @ApiProperty({
    description: '펫 종 (dog, cat, etc)',
    example: 'dog',
    enum: ['dog', 'cat', 'bird', 'rabbit', 'hamster', 'other']
  })
  @IsString()
  species: string;

  @ApiPropertyOptional({
    description: '펫 이름',
    example: '뽀삐'
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '펫 나이',
    example: 3
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  age?: number;

  @ApiPropertyOptional({
    description: '펫 성별',
    example: 'male',
    enum: ['male', 'female', 'unknown']
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: '펫 품종',
    example: '골든 리트리버'
  })
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({
    description: '펫 색상',
    example: 'golden'
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: '펫 무게 (kg)',
    example: 25.5
  })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({
    description: '비문 데이터 (ML 서버에서 생성된 feature vector)',
    example: { features: [0.1, 0.2, 0.3] }
  })
  @IsOptional()
  @IsObject()
  biometricData?: any;

  @ApiPropertyOptional({
    description: 'ML 모델 서버 참조',
    example: 'model-server-v1.0',
    default: 'model-server-ref'
  })
  @IsOptional()
  @IsString()
  modelServerReference?: string;

  @ApiPropertyOptional({
    description: '비문 샘플 수',
    example: 5,
    default: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(255)
  sampleCount?: number;

  @ApiPropertyOptional({
    description: '마이크로칩 번호',
    example: '900123456789012'
  })
  @IsOptional()
  @IsString()
  microchipId?: string;

  @ApiPropertyOptional({
    description: '등록 번호',
    example: 'REG-2024-001'
  })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({
    description: '추가 메타데이터 (JSON)',
    example: { vaccinations: ['rabies', 'distemper'], allergies: [] }
  })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiPropertyOptional({
    description: '서명된 트랜잭션 (프로덕션 모드에서만 필요)',
    example: '0x...'
  })
  @IsOptional()
  @IsString()
  signedTx?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsObject, IsEnum, IsBoolean, Min, Max } from 'class-validator';
import { Breed } from 'src/common/enums/breed.enum';
import { Gender } from 'src/common/enums/gender.enum';

export class CreatePetDto {
  @ApiProperty({
    description: '펫 종 (dog, cat, etc)',
    example: 'dog',
    enum: ['dog', 'cat', 'bird', 'rabbit', 'hamster', 'other']
  })
  @IsString()
  species: string;

  @ApiPropertyOptional({
    description: '반려동물 이름',
    example: '뽀삐'
  })
  @IsOptional()
  @IsString()
  petName?: string;

  @ApiPropertyOptional({
    description: '반려동물 나이',
    example: 3
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  old?: number;

  @ApiPropertyOptional({
    description: '반려동물 성별',
    enum: Gender,
    example: Gender.MAIL
  })
  @IsOptional()
  @IsEnum(Gender, { message: '성별은 유효한 성별이어야 합니다.' })
  gender?: Gender;

  @ApiPropertyOptional({
    description: '반려동물 품종',
    enum: Breed,
    example: Breed.GOLDEN_RETRIEVER
  })
  @IsOptional()
  @IsEnum(Breed, { message: '품종은 유효한 품종이어야 합니다.' })
  breed?: Breed;

  @ApiPropertyOptional({
    description: '털 색',
    example: '갈색'
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: '반려동물 몸무게 (kg)',
    example: 25.5
  })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({
    description: '특성',
    example: '활발함'
  })
  @IsOptional()
  @IsString()
  feature?: string;

  @ApiPropertyOptional({
    description: '중성화 여부',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  neutered?: boolean;

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

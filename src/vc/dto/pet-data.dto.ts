import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, ValidateNested, IsEnum, IsNumber } from 'class-validator';
import { Breed } from 'src/common/enums/breed.enum';
import { Gender } from 'src/common/enums/gender.enum';

export class PetDataDto {
  @ApiProperty({ description: '반려동물 이름' })
  @IsString()
  @IsOptional()
  petName?: string;

  @ApiProperty({ 
    description: '반려동물 품종',
    enum: Breed,
    example: Breed.SHIBA_INU
  })
  @IsOptional()
  @IsEnum(Breed, { message: '품종은 유효한 품종이어야 합니다.' })
  breed?: Breed;

  @ApiProperty({
    description: '반려동물 나이',
    example: '3',
    required: false
  })
  @IsOptional()
  @IsNumber()
  old?: number;

  @ApiProperty({
    description: '반려동물 몸무게',
    example: '2',
    required: false
  })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiProperty({
    description: '반려동물 성별',
    enum: Gender,
    example: Gender.female
  })
  @IsOptional()
  @IsEnum(Gender, { message: '성별은 유효한 성별이어야 합니다.' })
  gender?: Gender;

  @ApiProperty({
    description: '털 색',
    example: '갈색'
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({
    description: '특성',
    example: '활발함'
  })
  @IsString()
  @IsOptional()
  feature?: string;

  @ApiProperty({
    description: '중성화 여부',
    example: true
  })
  @IsOptional()
  neutered?: boolean; 
}


/**
 * 
 * 
 * 
 * 
사진은 한장 presigned url
반려동물 이름: string (제한 X)
품종 선택: Enum? -> 카톡보고
나이: int 
성별: 남/여
중성화: boolean
몸무게: int
털색: string
특성(feature): string
중성화 여부: boolean
추가 메모: string
 */
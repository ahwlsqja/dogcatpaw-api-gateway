import { IsString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';

export class PetDataDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // 삭제
  @IsString()
  @IsNotEmpty()
  species: string;

  @IsString()
  @IsOptional()
  breed?: string;

  @IsString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  color?: string;
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
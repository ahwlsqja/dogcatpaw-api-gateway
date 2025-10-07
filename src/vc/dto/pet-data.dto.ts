import { IsString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';

export class PetDataDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
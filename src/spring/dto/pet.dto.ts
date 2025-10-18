import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class RegisterPetDto {
  @ApiProperty({ description: 'Pet DID' })
  @IsString()
  @IsNotEmpty()
  did: string;

  @ApiProperty({ description: 'Pet profile image URL', required: false })
  @IsString()
  @IsOptional()
  petProfile?: string;

  @ApiProperty({ description: 'Pet name' })
  @IsString()
  @IsNotEmpty()
  petName: string;

  @ApiProperty({ description: 'Breed' })
  @IsString()
  @IsNotEmpty()
  breed: string;

  @ApiProperty({ description: 'Age', required: false })
  @IsNumber()
  @IsOptional()
  old?: number;

  @ApiProperty({ description: 'Weight', required: false })
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiProperty({ description: 'Gender', required: false })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiProperty({ description: 'Color', required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ description: 'Feature/specifics', required: false })
  @IsString()
  @IsOptional()
  feature?: string;

  @ApiProperty({ description: 'Additional specifics', required: false })
  @IsString()
  @IsOptional()
  specifics?: string;

  @ApiProperty({ description: 'Neutered status', required: false })
  @IsBoolean()
  @IsOptional()
  neutral?: boolean;

  @ApiProperty({ description: "PetImage", required: true})
  @IsString()
  @IsNotEmpty()
  images: string;
}

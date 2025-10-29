import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Gender } from 'src/common/enums/gender.enum';

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

  @ApiProperty({
    description: 'Pet gender: MALE (Male) or FEMALE (Female)',
    required: false,
    enum: Gender,
    example: Gender.MALE
  })
  @IsOptional()
  @IsEnum(Gender, { message: '반려동물 성별은 MALE(수컷) 또는 FEMALE(암컷)이어야 합니다.' })
  gender?: Gender;

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

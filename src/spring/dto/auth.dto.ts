import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { Gender } from 'src/common/enums/gender.enum';

export class SignupRequestDto {
  @ApiProperty({ description: 'Wallet address' })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({ description: 'Username', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ description: 'Nickname' })
  @IsString()
  @IsNotEmpty()
  nickname: string;

  @ApiProperty({
    description: 'Gender: MALE (Male) or FEMALE (Female)',
    required: false,
    enum: Gender,
    example: Gender.MALE
  })
  @IsOptional()
  @IsEnum(Gender, { message: '성별은 MALE(남성) 또는 FEMALE(여성)이어야 합니다.' })
  gender?: Gender;

  @ApiProperty({ description: 'Age', required: false })
  @IsNumber()
  @IsOptional()
  old?: number;

  @ApiProperty({ description: 'Address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'User type', required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'Email' })
  @IsString()
  @IsNotEmpty()
  email: string;
}

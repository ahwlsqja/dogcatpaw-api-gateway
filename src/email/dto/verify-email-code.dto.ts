import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailCodeDto {
  @ApiProperty({
    example: '123456',
    description: '6자리 인증 코드',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class VerifyEmailCodeResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty({ required: false })
  error?: string;

  @ApiProperty({ required: false })
  warning?: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  remainingAttempts?: number;
}
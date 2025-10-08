import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendVerificationCodeDto {
  @ApiProperty({
    example: 'user@example.com',
    description: '인증 코드를 받을 이메일 주소',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class SendVerificationCodeResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty({ required: false })
  error?: string;
}
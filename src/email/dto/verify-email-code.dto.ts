import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailCodeDto {
  @ApiProperty({
    description: '6-digit verification code received via email',
    example: '123456',
    required: true,
    minLength: 6,
    maxLength: 6,
    pattern: '^[0-9]{6}$',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'Code must contain only numeric digits' })
  code: string;
}

export class VerifyEmailCodeResponseDto {
  @ApiProperty({
    description: 'Indicates if verification was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message confirming email verification and account registration',
    example: '이메일 검증이 완료되었고 계정이 등록되었습니다!',
    required: false,
  })
  message?: string;

  @ApiProperty({
    description: 'Error message if verification failed',
    example: 'Invalid verification code',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Warning message (e.g., email verified but account registration failed)',
    example: '이메일 검증은 성공이 성공했습니다!',
    required: false,
  })
  warning?: string;

  @ApiProperty({
    description: 'Verified email address',
    example: 'user@example.com',
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: 'Number of verification attempts remaining (before code is invalidated)',
    example: 2,
    minimum: 0,
    maximum: 3,
    required: false,
  })
  remainingAttempts?: number;
}
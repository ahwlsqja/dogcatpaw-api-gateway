import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendVerificationCodeDto {
  @ApiProperty({
    description: 'Email address to receive verification code',
    example: 'user@example.com',
    required: true,
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

export class SendVerificationCodeResponseDto {
  @ApiProperty({
    description: 'Indicates if the code was sent successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message with code expiration info',
    example: 'Verification code sent to user@example.com. Code expires in 10 minutes.',
    required: false,
  })
  message?: string;

  @ApiProperty({
    description: 'Error message if code sending failed',
    example: 'Rate limit exceeded. Please try again in 60 seconds.',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Code expiration timestamp (Unix timestamp in milliseconds)',
    example: 1703001234567,
    required: false,
  })
  expiresAt?: number;

  @ApiProperty({
    description: 'Remaining time until next code can be requested (seconds)',
    example: 60,
    required: false,
  })
  cooldownSeconds?: number;
}
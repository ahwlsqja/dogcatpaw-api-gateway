import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject, IsLowercase } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({
    description: 'Wallet address (MUST be lowercase)',
    example: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @IsLowercase({ message: 'Wallet address must be lowercase' })
  walletAddress: string;

  @ApiProperty({
    description: 'Signature of the challenge message',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Original challenge string from /api/auth/challenge',
    example: 'Please sign this message to authenticate: 1234567890',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  challenge: string;

  @ApiProperty({
    description: 'VP signature (required if VCs exist)',
    example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    required: false,
  })
  @IsString()
  @IsOptional()
  vpSignature?: string;

  @ApiProperty({
    description: 'VP message object from challenge response',
    example: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: 'did:ethr:besu:0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  vpMessage?: any;

  @ApiProperty({
    description: 'VP signed data string',
    example: '{"@context":["https://www.w3.org/2018/credentials/v1"],...}',
    required: false,
  })
  @IsString()
  @IsOptional()
  vpSignedData?: string;
}

export class GuardianInfo {
  @ApiProperty({
    description: 'Guardian ID in VC service',
    example: 123,
  })
  guardianId: number;

  @ApiProperty({
    description: 'Guardian email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Guardian phone number',
    example: '010-1234-5678',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    description: 'Guardian full name',
    example: '홍길동',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: 'Email verification status',
    example: true,
  })
  isEmailVerified: boolean;

  @ApiProperty({
    description: 'On-chain registration status',
    example: true,
  })
  isOnChainRegistered: boolean;
}

export class ProfileData {
  @ApiProperty({
    description: 'Wallet address',
    example: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Guardian information (null if not registered)',
    type: GuardianInfo,
    nullable: true,
  })
  guardianInfo: GuardianInfo | null;

  @ApiProperty({
    description: 'Number of Verifiable Credentials owned',
    example: 3,
  })
  vcCount: number;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Login success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'JWT access token for API authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token to obtain new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Verifiable Presentation JWT ("EMPTY" if no VCs)',
    example: 'eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ...',
  })
  vpJwt: string;

  @ApiProperty({
    description: 'User profile data',
    type: ProfileData,
  })
  profile: ProfileData;

  @ApiProperty({
    description: 'Success message',
    example: '로그인이 성공했습니다!!',
  })
  message: string;
}

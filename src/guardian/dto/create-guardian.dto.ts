import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEthereumAddress, IsEmail, IsEnum } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class CreateGuardianDto {
  @ApiProperty({
    description: 'Email address (required). Must be verified via POST /email/verify-code before guardian registration.',
    example: 'user@example.com',
    required: true
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User role: USER (general pet guardian) or ADMIN (shelter/organization). Determines Spring backend registration flow.',
    example: Role.USER,
    enum: Role,
    default: Role.USER
  })
  @IsOptional()
  @IsEnum(Role, { message: "롤을 정해주세여"})
  role?: Role;

  @ApiPropertyOptional({
    description: 'Phone number in international format (optional but recommended for account recovery)',
    example: '+82-10-1234-5678'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Full name (optional). Used for user profile and pet ownership documentation.',
    example: '홍길동'
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Display nickname for community features (optional). Shown instead of real name in public areas.',
    example: '멋쟁이'
  })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({
    description: 'Profile image filename uploaded to S3 temp folder (optional). Use POST /common to get presigned URL first. Image will be moved to permanent storage after registration.',
    example: 'abc123-def456-ghi789.jpg'
  })
  @IsOptional()
  @IsString()
  profileUrl?: string;

  @ApiPropertyOptional({
    description: 'Gender: "M" (Male) or "F" (Female) (optional)',
    example: 'M',
    enum: ['M', 'F']
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: 'Age in years (optional). Used for demographic purposes.',
    example: 30,
    minimum: 1,
    maximum: 150
  })
  @IsOptional()
  @IsNumber()
  old?: number;

  @ApiPropertyOptional({
    description: 'Physical address or location (optional). Used for local pet services and adoption matching.',
    example: '서울시 강남구'
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Guardian wallet address (automatically extracted from JWT token, do not provide manually)',
    example: '0x1234567890123456789012345678901234567890'
  })
  @IsOptional()
  @IsEthereumAddress()
  walletAddress?: string;

  @ApiPropertyOptional({
    description: 'Personal data hash (calculated automatically from email, phone, name, timestamp). Do not provide manually.',
    default: '0x0000000000000000000000000000000000000000000000000000000000000001'
  })
  @IsOptional()
  @IsString()
  personalDataHash?: string;

  @ApiPropertyOptional({
    description: 'NCP storage URI (not used in current implementation). Always set to "0".',
    default: '0'
  })
  @IsOptional()
  @IsString()
  ncpStorageURI?: string;

  @ApiPropertyOptional({
    description: 'Verification method used: 1 (SMS), 2 (Email - default), 3 (Both). Email verification is required for registration.',
    default: 2,
    enum: [1, 2, 3]
  })
  @IsOptional()
  @IsNumber()
  verificationMethod?: number;

  @ApiPropertyOptional({
    description: 'Signed transaction for GuardianRegistry.registerGuardian() function. Required in production mode. Sign the transaction data prepared by this endpoint or use ethers.js to sign directly.',
    example: '0xf86c808504a817c800825208941234567890123456789012345678901234567890880de0b6b3a76400008025a0...'
  })
  @IsOptional()
  @IsString()
  signedTx?: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class CredentialStats {
  @ApiProperty({
    description: 'Total number of VCs',
    example: 3,
  })
  total: number;

  @ApiProperty({
    description: 'Number of pet VCs',
    example: 2,
  })
  pets: number;

  @ApiProperty({
    description: 'Number of identity VCs',
    example: 1,
  })
  identity: number;
}

export class PetInfo {
  @ApiProperty({
    description: 'Pet DID',
    example: 'did:ethr:besu:0xabc123...',
  })
  petDID: string;

  @ApiProperty({
    description: 'Pet name',
    example: '멍멍이',
  })
  name: string;

  @ApiProperty({
    description: 'Pet species',
    example: 'dog',
  })
  species: string;

  @ApiProperty({
    description: 'VC issuance date',
    example: '2024-01-15T10:30:00.000Z',
  })
  issuedAt: string;
}

export class GuardianProfileInfo {
  @ApiProperty({
    description: 'Guardian ID',
    example: 123,
  })
  guardianId: number;

  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Phone number',
    example: '010-1234-5678',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    description: 'Full name',
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

export class UserProfile {
  @ApiProperty({
    description: 'User DID',
    example: 'did:ethr:besu:0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
  })
  did: string;

  @ApiProperty({
    description: 'Wallet address',
    example: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Is registered as guardian',
    example: true,
  })
  isGuardian: boolean;

  @ApiProperty({
    description: 'Guardian information (null if not registered)',
    type: GuardianProfileInfo,
    nullable: true,
  })
  guardianInfo: GuardianProfileInfo | null;

  @ApiProperty({
    description: 'Credential statistics',
    type: CredentialStats,
  })
  credentials: CredentialStats;

  @ApiProperty({
    description: 'List of owned pets',
    type: [PetInfo],
  })
  pets: PetInfo[];
}

export class ProfileResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'User profile data',
    type: UserProfile,
  })
  profile: UserProfile;
}

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Logout message',
    example: 'Current session logged out successfully',
  })
  message: string;
}

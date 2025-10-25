import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsLowercase } from 'class-validator';

export class ChallengeRequestDto {
  @ApiProperty({
    description: 'Wallet address (MUST be lowercase)',
    example: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @IsLowercase({ message: 'Wallet address must be lowercase' })
  walletAddress: string;
}

export class VPSigningData {
  @ApiProperty({
    description: 'VP message object to be signed',
    example: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: 'did:ethr:besu:0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
    },
  })
  message: object;

  @ApiProperty({
    description: 'Keccak256 hash of the VP message for signing',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  messageHash: string;

  @ApiProperty({
    description: 'Full signing data string',
    example: '{"@context":["https://www.w3.org/2018/credentials/v1"],...}',
  })
  signingData: string;
}

export class ChallengeResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Challenge string to be signed with wallet',
    example: 'Please sign this message to authenticate: 1234567890',
  })
  challenge: string;

  @ApiProperty({
    description: 'VP signing data (null if no VCs found)',
    type: VPSigningData,
    nullable: true,
    required: false,
  })
  vpSigningData: VPSigningData | null;

  @ApiProperty({
    description: 'Instruction message',
    example: 'Sign both challenge and VP message with your wallet',
  })
  message: string;

  @ApiProperty({
    description: 'Challenge expiration time in seconds',
    example: 300,
  })
  expiresIn: number;
}

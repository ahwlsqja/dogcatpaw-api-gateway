import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress, IsOptional, IsString, IsObject, IsNumber } from 'class-validator';
import { PetDataDto } from 'src/vc/dto/pet-data.dto';

export class PrepareTransferDto {
  @ApiProperty({
    description: 'New guardian wallet address (lowercase, 0x-prefixed). This guardian will become the new owner of the pet.',
    example: '0x1234567890123456789012345678901234567890'
  })
  @IsEthereumAddress()
  newGuardianAddress: string;

  @ApiProperty({
    description: 'Pet data to include in the new guardian\'s VC (Verifiable Credential). This should match the current pet profile data.',
    type: PetDataDto
  })
  @IsObject()
  petData: PetDataDto;
}

export class AcceptTransferDto {
  @ApiProperty({
    description: 'New guardian signature on VC transfer message. This proves new guardian consents to receiving ownership.',
    example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab1b'
  })
  @IsString()
  signature: string;

  @ApiProperty({
    description: 'VC transfer message that was signed. Contains VC data with previousGuardian, newGuardian, petDID, biometricHash, and petData.',
    example: {
      vc: {
        vcType: 'GuardianPetOwnershipTransferVC',
        credentialSubject: {
          previousGuardian: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
          guardian: '0x1234567890123456789012345678901234567890',
          petDID: 'did:ethr:besu:0xabcdef...',
          biometricHash: '0x...',
          petData: {}
        },
        issuedAt: '2025-10-25T12:00:00Z',
        nonce: 'abc123'
      }
    }
  })
  @IsObject()
  message: any;

  @ApiProperty({
    description: 'Pet data to include in the new VC. Should match current pet profile.',
    type: PetDataDto
  })
  @IsObject()
  petData: PetDataDto;

  @ApiProperty({
    description: 'Biometric verification proof from POST /pet/verify-transfer/:petDID. Proves new guardian submitted matching nose print (≥50% similarity). Valid for 10 minutes.',
    example: {
      petDID: 'did:ethr:besu:0xabcdef...',
      newGuardian: '0x1234567890123456789012345678901234567890',
      similarity: 85,
      verifiedAt: '2025-10-25T12:00:00.000Z',
      nonce: 'xyz789'
    }
  })
  @IsObject()
  verificationProof: any;

  @ApiPropertyOptional({
    description: 'Signed transaction for PetDIDRegistry.changeController() function. Changes on-chain controller from previous guardian to new guardian. Required in production mode.',
    example: '0xf86c808504a817c800825208941234567890123456789012345678901234567890880de0b6b3a76400008025a0...'
  })
  @IsOptional()
  @IsString()
  signedTx?: string;
}

export class VerifyTransferResponseDto {
  @ApiProperty({
    description: 'Whether biometric verification succeeded',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Similarity score between uploaded nose print and stored pet nose print (0-100). Threshold is 50% for successful verification.',
    example: 85
  })
  @IsNumber()
  similarity: number;

  @ApiProperty({
    description: 'Human-readable verification result message',
    example: '비문 검증 성공! 이제 소유권 이전을 완료할 수 있습니다.'
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Verification proof object to be submitted with accept-transfer request. Valid for 10 minutes.',
    example: {
      petDID: 'did:ethr:besu:0xabcdef...',
      newGuardian: '0x1234567890123456789012345678901234567890',
      similarity: 85,
      verifiedAt: '2025-10-25T12:00:00.000Z',
      nonce: 'xyz789'
    }
  })
  verificationProof?: any;

  @ApiPropertyOptional({
    description: 'Keccak256 hash of verification proof for integrity checking',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  })
  proofHash?: string;

  @ApiPropertyOptional({
    description: 'Next step instructions for completing ownership transfer',
    example: 'Call POST /pet/accept-transfer/:petDID with signature and this proof'
  })
  nextStep?: string;

  @ApiPropertyOptional({
    description: 'Error message if verification failed',
    example: '비문이 일치하지 않습니다. 소유권 이전을 진행할 수 없습니다.'
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Similarity threshold percentage required for successful verification',
    example: 50
  })
  threshold?: number;
}

export class TransferPetResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  txHash: string;

  @ApiProperty()
  blockNumber: number;

  @ApiProperty()
  similarity: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  error?: string;
}
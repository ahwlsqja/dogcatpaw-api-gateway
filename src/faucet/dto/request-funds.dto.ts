// api-gateway/src/faucet/dto/request-funds.dto.ts
import { IsString, IsOptional, IsEthereumAddress } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestFundsDto {
  @ApiProperty({
    description: 'Ethereum wallet address to receive test ETH. Must be valid Ethereum address format (42 characters, starts with 0x)',
    example: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
    required: true,
    type: String,
  })
  @IsEthereumAddress()
  @IsString()
  walletAddress: string;

  @ApiPropertyOptional({
    description: 'Amount of test ETH to request. If not specified, defaults to 100 ETH. Maximum amount is determined by FAUCET_MAX_AMOUNT configuration.',
    example: '100',
    default: '100',
    type: String,
  })
  @IsOptional()
  @IsString()
  amount?: string;
}

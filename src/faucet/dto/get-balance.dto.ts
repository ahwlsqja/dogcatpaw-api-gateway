// api-gateway/src/faucet/dto/get-balance.dto.ts
import { IsString, IsOptional, IsEthereumAddress } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetBalanceDto {
  @ApiPropertyOptional({
    description: 'Ethereum wallet address to check balance. If not provided, returns the balance of the faucet service itself. Must be valid Ethereum address format.',
    example: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
    type: String,
  })
  @IsOptional()
  @IsEthereumAddress()
  @IsString()
  address?: string;
}

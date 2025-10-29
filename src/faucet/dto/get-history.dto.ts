// api-gateway/src/faucet/dto/get-history.dto.ts
import { IsString, IsOptional, IsEthereumAddress, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetHistoryDto {
  @ApiPropertyOptional({
    description: 'Filter transactions by specific wallet address. If not provided, returns all recent faucet transactions (not filtered by address). Must be valid Ethereum address format.',
    example: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
    type: String,
  })
  @IsOptional()
  @IsEthereumAddress()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of transactions to return. Minimum: 1, Maximum: 100. Transactions are sorted by timestamp (most recent first).',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class VcSyncDto {
  @ApiProperty({ description: 'Member wallet address' })
  @IsString()
  @IsNotEmpty()
  memberWallet: string;

  @ApiProperty({ description: 'Array of VC JWT tokens', type: [String] })
  @IsArray()
  @IsString({ each: true })
  vcJwt: string[];
}

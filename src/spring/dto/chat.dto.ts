import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateChatRoomDto {
  @ApiProperty({ description: 'Adoption post writer ID' })
  @IsNumber()
  @IsNotEmpty()
  adoptWriterId: number;

  @ApiProperty({ description: 'Adoption post ID' })
  @IsNumber()
  @IsNotEmpty()
  adoptId: number;

  @ApiProperty({ description: 'Room name', required: false })
  @IsString()
  @IsOptional()
  roomName?: string;
}

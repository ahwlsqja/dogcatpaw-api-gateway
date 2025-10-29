import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsLowercase } from 'class-validator';

export class CreateChatRoomDto {
  @ApiProperty({
    description: 'Adoption post ID to create chat room for',
    example: 456,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  adoptId: number;

  @ApiProperty({
    description: 'Custom room name (optional, defaults to adoption post title)',
    example: '골든 리트리버 입양 문의',
    required: false,
  })
  @IsString()
  @IsOptional()
  roomName?: string;
}

export class ChatRoomResponseDto {
  @ApiProperty({
    description: 'Created chat room ID',
    example: 123,
  })
  roomId: number;

  @ApiProperty({
    description: 'Adoption post ID',
    example: 456,
  })
  adoptId: number;

  @ApiProperty({
    description: 'Room name',
    example: '골든 리트리버 입양 문의',
  })
  roomName: string;

  @ApiProperty({
    description: 'Room creation timestamp',
    example: '2025-10-25T12:00:00.000Z',
  })
  createdAt: string;
}

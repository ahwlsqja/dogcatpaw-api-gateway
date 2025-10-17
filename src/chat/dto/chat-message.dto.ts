import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 클라이언트에서 서버로 전송하는 채팅 메시지
 */
export class SendMessageDto {
  @ApiProperty({ description: 'Room ID' })
  @IsNumber()
  @IsNotEmpty()
  roomId: number;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

/**
 * 서버에서 클라이언트로 전송하는 채팅 메시지
 */
export class ChatMessageDto {
  @ApiProperty({ description: 'Message ID' })
  messageId: number;

  @ApiProperty({ description: 'Room ID' })
  roomId: number;

  @ApiProperty({ description: 'Sender wallet address' })
  senderId: string;

  @ApiProperty({ description: 'Sender nickname' })
  senderName: string;

  @ApiProperty({ description: 'Message content' })
  message: string;

  @ApiProperty({ description: 'Read status' })
  isRead: boolean;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

/**
 * 방 입장 DTO
 */
export class JoinRoomDto {
  @ApiProperty({ description: 'Room ID to join' })
  @IsNumber()
  @IsNotEmpty()
  roomId: number;
}

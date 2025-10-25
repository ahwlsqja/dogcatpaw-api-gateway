import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * WebSocket Event: sendMessage
 *
 * Client → Server: Send a chat message
 *
 * Usage:
 * socket.emit('sendMessage', { roomId: 123, message: 'Hello!' }, (response) => {
 *   console.log('Message sent:', response.success);
 * });
 */
export class SendMessageDto {
  @ApiProperty({
    description: 'Chat room ID to send message to',
    example: 123,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  roomId: number;

  @ApiProperty({
    description: 'Message content (text)',
    example: '안녕하세요! 입양 문의드립니다.',
    required: true,
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

/**
 * WebSocket Event: message (broadcast)
 *
 * Server → Client: Receive a chat message (real-time)
 *
 * This is broadcast to all connected clients in the room when:
 * - Another user sends a message
 * - Message is successfully saved to database
 * - Spring publishes to Redis: nestjs:broadcast:{roomId}
 *
 * Usage:
 * socket.on('message', (data: ChatMessageDto) => {
 *   console.log('New message:', data.message);
 *   console.log('From:', data.senderId);
 * });
 */
export class ChatMessageDto {
  @ApiProperty({
    description: 'Unique message ID from database',
    example: 456,
  })
  messageId: number;

  @ApiProperty({
    description: 'Room ID this message belongs to',
    example: 123,
  })
  roomId: number;

  @ApiProperty({
    description: 'Sender wallet address (lowercase)',
    example: '0x9c34c486ae5fc0def0ec9cd138ddc55e96f0d5e0',
  })
  senderId: string;

  @ApiProperty({
    description: 'Sender display name or nickname',
    example: 'User B',
    required: false,
  })
  senderName?: string;

  @ApiProperty({
    description: 'Message text content',
    example: '안녕하세요! 입양 문의드립니다.',
  })
  message: string;

  @ApiProperty({
    description: 'Whether the message has been read by recipient',
    example: false,
  })
  isRead: boolean;

  @ApiProperty({
    description: 'Message creation timestamp (ISO 8601)',
    example: '2025-10-25T12:30:00.000Z',
  })
  createdAt: string;
}

/**
 * WebSocket Event: joinRoom
 *
 * Client → Server: Join a chat room and get message history
 *
 * This event:
 * 1. Verifies user has permission to join (checks chat_participant)
 * 2. Subscribes client to Socket.IO room for real-time updates
 * 3. Marks all messages in room as read for current user
 * 4. Returns complete message history
 *
 * Usage:
 * socket.emit('joinRoom', { roomId: 123 }, (response) => {
 *   if (response.success) {
 *     console.log('Message history:', response.messages);
 *     console.log('Total messages:', response.messages.length);
 *   }
 * });
 */
export class JoinRoomDto {
  @ApiProperty({
    description: 'Chat room ID to join',
    example: 123,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  roomId: number;
}

/**
 * WebSocket Response: joinRoom acknowledgement
 *
 * Server → Client: Response after joining room
 */
export class JoinRoomResponseDto {
  @ApiProperty({
    description: 'Whether join was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success or error message',
    example: 'Joined room 123',
  })
  message: string;

  @ApiProperty({
    description: 'Array of message history (all messages in room)',
    type: [ChatMessageDto],
    required: false,
  })
  messages?: ChatMessageDto[];

  @ApiProperty({
    description: 'Error message if join failed',
    example: 'No permission to join this room',
    required: false,
  })
  error?: string;
}

/**
 * WebSocket Event: leaveRoom
 *
 * Client → Server: Leave a chat room
 *
 * Usage:
 * socket.emit('leaveRoom', { roomId: 123 }, (response) => {
 *   console.log('Left room:', response.success);
 * });
 */
export class LeaveRoomDto {
  @ApiProperty({
    description: 'Chat room ID to leave',
    example: 123,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  roomId: number;
}

/**
 * WebSocket Response: sendMessage acknowledgement
 *
 * Server → Client: Response after sending message
 */
export class SendMessageResponseDto {
  @ApiProperty({
    description: 'Whether message was sent successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success or error message',
    example: 'Message sent',
  })
  message: string;

  @ApiProperty({
    description: 'The sent message data',
    type: ChatMessageDto,
    required: false,
  })
  data?: ChatMessageDto;

  @ApiProperty({
    description: 'Error message if send failed',
    example: 'User not authorized to send messages in this room',
    required: false,
  })
  error?: string;
}

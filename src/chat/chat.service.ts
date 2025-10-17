// src/chat/chat.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SpringProxyService } from '../spring/spring.proxy.service';
import { RedisService } from '../common/redis/redis.service';
import { SendMessageDto, ChatMessageDto } from './dto/chat-message.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * 채팅 비즈니스 로직 서비스
 * - Redis Pub/Sub으로 실시간 브로드캐스트
 * - Spring이 구독하여 Memory Queue → Batch DB 저장
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly springProxyService: SpringProxyService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 메시지 브로드캐스트 (이벤트 기반)
   *
   * 흐름:
   * 1. NestJS: Redis publish
   * 2. Spring Subscriber: Memory Queue에 추가
   * 3. Spring Batch: DB 저장 (1초마다 또는 100개마다)
   * 4. 모든 WebSocket 클라이언트: 실시간 수신
   */
  async sendMessage(
    walletAddress: string,
    dto: SendMessageDto,
  ): Promise<ChatMessageDto> {
    try {
      // 메시지 생성 (UUID 사용으로 일관성 보장)
      const chatMessage: ChatMessageDto = {
        messageId: Date.now(), // 임시 타임스탬프 ID
        roomId: dto.roomId,
        senderId: walletAddress,
        senderName: walletAddress.substring(0, 10), // 닉네임은 Spring에서 처리
        message: dto.message,
        isRead: false,
        createdAt: new Date(),
      };

      // Redis Pub/Sub으로 브로드캐스트
      // - NestJS Gateway: 실시간 클라이언트 전송
      // - Spring Subscriber: Memory Queue → Batch DB 저장
      await this.publishMessage(dto.roomId, chatMessage);

      this.logger.debug(`Message published to Redis: room ${dto.roomId}`);

      return chatMessage;
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Redis Pub/Sub으로 메시지 발행
   */
  private async publishMessage(roomId: number, message: ChatMessageDto): Promise<void> {
    const channel = `chat:room:${roomId}`;
    await this.redisService.publish(channel, JSON.stringify(message));
    this.logger.debug(`Published message to channel: ${channel}`);
  }

  /**
   * 채팅방 입장 권한 확인
   */
  async canJoinRoom(walletAddress: string, roomId: number): Promise<boolean> {
    try {
      // Spring 서버에서 권한 확인
      const response = await this.springProxyService.proxyToSpring(
        'get',
        '/api/chat/room/check-permission',
        undefined,
        { roomId, walletAddress },
        { 'X-Wallet-Address': walletAddress }
      );

      return response.canJoin === true;
    } catch (error) {
      this.logger.error(`Failed to check room permission: ${error.message}`);
      return false;
    }
  }
}

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
   * 메시지 브로드캐스트 (Spring 통합)
   *
   * 흐름:
   * 1. NestJS: Redis "chat" 채널에 publish (Spring 형식)
   * 2. Spring: Redis 구독 → DB 저장 → "nestjs:broadcast:{roomId}" 재발행
   * 3. NestJS: Redis 구독 → Socket.io로 클라이언트들에게 브로드캐스트
   */
  async sendMessage(
    walletAddress: string,
    dto: SendMessageDto,
  ): Promise<any> {
    try {
      // Spring이 기대하는 형식으로 메시지 생성
      const springMessage = {
        roomId: dto.roomId,
        chatSenderId: walletAddress,  // Spring 형식: chatSenderId (지갑 주소)
        message: dto.message,
      };

      // Redis "chat" 채널로 발행 (Spring이 구독 중)
      await this.redisService.publish('chat', JSON.stringify(springMessage));

      this.logger.debug(`Message published to Spring: room ${dto.roomId}, sender ${walletAddress}`);

      return {
        roomId: dto.roomId,
        chatSenderId: walletAddress,
        message: dto.message,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 채팅방 입장 권한 확인 (Spring API 호출)
   */
  async canJoinRoom(walletAddress: string, roomId: number): Promise<boolean> {
    try {
      // Spring 서버 권한 체크 API 호출
      const response = await this.springProxyService.proxyToSpring(
        'get',
        '/api/chat/room/check-permission',
        undefined,
        { roomId, walletAddress },
      );

      this.logger.debug(`Permission check result: room ${roomId}, user ${walletAddress}, canJoin=${response.canJoin}`);

      return response.canJoin === true;
    } catch (error) {
      this.logger.error(`Failed to check room permission: ${error.message}`);
      // 에러 시 안전하게 false 반환 (권한 없음)
      return false;
    }
  }

  /**
   * 채팅방 입장 - 메시지 히스토리 조회 + 읽음 처리
   *
   * Spring의 enterRoom API를 호출하여:
   * 1. 채팅방의 모든 메시지 조회
   * 2. 읽지 않은 메시지를 읽음 처리 (markAsReadCount)
   *
   * @param walletAddress 사용자 지갑 주소
   * @param roomId 채팅방 ID
   * @returns 메시지 히스토리 배열
   */
  async enterRoom(walletAddress: string, roomId: number): Promise<any[]> {
    try {
      // Spring의 enterRoom API 호출
      // POST /api/chat/{roomId}/enter
      const response = await this.springProxyService.enterChatRoom(roomId, walletAddress);

      this.logger.log(
        `User ${walletAddress} entered room ${roomId}, retrieved ${response?.length || 0} messages`
      );

      return response || [];
    } catch (error) {
      this.logger.error(`Failed to enter room ${roomId}: ${error.message}`);
      // 에러 시 빈 배열 반환 (입장은 허용하되 히스토리 조회 실패)
      return [];
    }
  }
}

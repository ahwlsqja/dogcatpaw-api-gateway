// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto, JoinRoomDto } from './dto/chat-message.dto';
import { RedisService } from '../common/redis/redis.service';

/**
 * WebSocket 채팅 게이트웨이
 * - Socket.io 기반
 * - VP 인증 (WsAuthAdapter)
 * - Redis Pub/Sub 통합
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private redisSubscriber: any;

  constructor(
    private readonly chatService: ChatService,
    private readonly redisService: RedisService,
  ) {
    // Redis Subscriber 초기화
    this.initRedisSubscriber();
  }

  /**
   * Redis Pub/Sub Subscriber 초기화
   * Spring에서 "nestjs:broadcast:{roomId}" 채널로 발행한 메시지를 구독
   */
  private async initRedisSubscriber() {
    this.redisSubscriber = this.redisService.duplicate();

    // 패턴 구독: nestjs:broadcast:* (모든 방)
    this.redisSubscriber.psubscribe('nestjs:broadcast:*');

    // 패턴 메시지 수신 핸들러
    this.redisSubscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      try {
        // channel = "nestjs:broadcast:1"
        if (channel.startsWith('nestjs:broadcast:')) {
          const roomId = channel.replace('nestjs:broadcast:', '');
          this.logger.debug(`Broadcasting message from Spring to room ${roomId}`);

          // Socket.io 방으로 브로드캐스트
          this.server.to(`room:${roomId}`).emit('message', JSON.parse(message));
        }
      } catch (error) {
        this.logger.error(`Failed to broadcast message: ${error.message}`);
      }
    });

    this.logger.log('Redis subscriber initialized for chat (nestjs:broadcast:* pattern)');
  }

  /**
   * 클라이언트 연결 시
   */
  async handleConnection(client: Socket) {
    const user = client.data.user;

    if (!user) {
      this.logger.warn(`Unauthorized connection attempt`);
      client.disconnect();
      return;
    }

    this.logger.log(`Client connected: ${client.id}, User: ${user.address}`);
  }

  /**
   * 클라이언트 연결 해제 시
   */
  handleDisconnect(client: Socket) {
    const user = client.data.user;
    this.logger.log(`Client disconnected: ${client.id}, User: ${user?.address}`);
  }

  /**
   * 채팅방 입장
   *
   * 흐름:
   * 1. Spring API로 권한 확인 (chat_participant 테이블 확인)
   * 2. Socket.io room 입장 (실시간 통신)
   * 3. Spring API로 메시지 히스토리 조회 + 읽음 처리
   * 4. 메시지 히스토리와 함께 응답
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    const user = client.data.user;

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      // 1. Spring API로 권한 확인
      const canJoin = await this.chatService.canJoinRoom(user.address, dto.roomId);

      if (!canJoin) {
        this.logger.warn(`User ${user.address} denied access to room ${dto.roomId}`);
        return { success: false, error: 'No permission to join this room' };
      }

      // 2. Socket.io 방 입장 (실시간 통신)
      await client.join(`room:${dto.roomId}`);

      // 3. Spring API로 메시지 히스토리 조회 + 읽음 처리
      const messages = await this.chatService.enterRoom(user.address, dto.roomId);

      this.logger.log(
        `User ${user.address} joined room ${dto.roomId} with ${messages.length} messages`
      );

      // 4. 메시지 히스토리와 함께 응답
      return {
        success: true,
        message: `Joined room ${dto.roomId}`,
        messages: messages,  // 메시지 히스토리 포함
      };
    } catch (error) {
      this.logger.error(`Failed to join room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 채팅방 퇴장
   * Socket.io room만 퇴장 (Redis는 패턴 구독이므로 개별 unsubscribe 불필요)
   */
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    const user = client.data.user;

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      // Socket.io 방 퇴장
      await client.leave(`room:${dto.roomId}`);

      this.logger.log(`User ${user.address} left room ${dto.roomId}`);

      return {
        success: true,
        message: `Left room ${dto.roomId}`,
      };
    } catch (error) {
      this.logger.error(`Failed to leave room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 메시지 전송
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const user = client.data.user;

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      // 메시지 저장 및 브로드캐스트
      const message = await this.chatService.sendMessage(user.address, dto);

      return {
        success: true,
        message: 'Message sent',
        data: message,
      };
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

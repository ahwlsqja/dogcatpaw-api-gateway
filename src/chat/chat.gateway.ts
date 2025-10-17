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
   */
  private async initRedisSubscriber() {
    this.redisSubscriber = this.redisService.duplicate();

    this.redisSubscriber.on('message', (channel: string, message: string) => {
      // Redis에서 메시지 받으면 해당 방으로 브로드캐스트
      if (channel.startsWith('chat:room:')) {
        const roomId = channel.replace('chat:room:', '');
        this.logger.debug(`Broadcasting message to room ${roomId}`);
        this.server.to(`room:${roomId}`).emit('message', JSON.parse(message));
      }
    });

    this.logger.log('Redis subscriber initialized for chat');
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
   * TODO: 스프링으로 채팅방 입장 영속성 필요장 
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
      // 권한 확인
      const canJoin = await this.chatService.canJoinRoom(user.address, dto.roomId);

      if (!canJoin) {
        return { success: false, error: 'No permission to join this room' };
      }

      // Socket.io 방 입장
      await client.join(`room:${dto.roomId}`);

      // Redis 채널 구독
      await this.redisSubscriber.subscribe(`chat:room:${dto.roomId}`);

      this.logger.log(`User ${user.address} joined room ${dto.roomId}`);

      return {
        success: true,
        message: `Joined room ${dto.roomId}`,
      };
    } catch (error) {
      this.logger.error(`Failed to join room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 채팅방 퇴장
   * TODO: 스프링으로 채팅방 퇴장 영속성 필요장
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

      // Redis 채널 구독 해제
      await this.redisSubscriber.unsubscribe(`chat:room:${dto.roomId}`);

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

// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import {
  SendMessageDto,
  JoinRoomDto,
  LeaveRoomDto,
  JoinRoomResponseDto,
  SendMessageResponseDto,
} from './dto/chat-message.dto';
import { RedisService } from '../common/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../auth/services/token.service';
import { AuthService } from '../auth/auth.service';

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
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private redisSubscriber: any;

  constructor(
    private readonly chatService: ChatService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
  ) {
    // Redis Subscriber 초기화
    this.initRedisSubscriber();
  }

  /**
   * Gateway 초기화 후 호출 - 인증 미들웨어 적용
   */
  afterInit(server: Server) {
    this.logger.log('ChatGateway initialized - Setting up authentication middleware');

    // WebSocket 연결 시 인증 미들웨어
    server.use(async (socket, next) => {
      try {
        this.logger.debug('WebSocket authentication middleware triggered');
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

        this.logger.debug(`Token received: ${token ? token.substring(0, 30) + '...' : 'none'}`);

        if (!token) {
          this.logger.warn('No token provided in WebSocket connection');
          return next(new Error('Authentication token missing'));
        }

        // 1. 블록된 토큰 확인
        const isBlocked = await this.tokenService.isTokenBlocked(token);
        if (isBlocked) {
          this.logger.warn(`Blocked token attempted WebSocket connection`);
          return next(new Error('Token has been revoked'));
        }

        // 2. JWT 검증
        let payload;
        try {
          payload = this.jwtService.verify(token);
          this.logger.debug(`JWT verified for address: ${payload.address}`);
        } catch (error) {
          this.logger.error(`JWT verification failed: ${error.message}`);
          return next(new Error('Invalid token'));
        }

        // 3. VP 검증 (캐시 우선)
        const vpJwt = await this.tokenService.getVPForToken(token);
        this.logger.debug(`VP JWT: ${vpJwt ? (vpJwt === 'EMPTY' ? 'EMPTY' : 'exists') : 'none'}`);

        if (vpJwt && vpJwt !== 'EMPTY') {
          // 3-1. 캐시된 VP 검증 결과 확인
          const cachedVerification = await this.tokenService.getCachedVPVerification(token);

          if (cachedVerification && cachedVerification.verified) {
            this.logger.debug(`VP cache hit for WebSocket: ${payload.address}`);

            socket.data.user = {
              address: payload.address,
              isGuardian: payload.isGuardian,
              vpVerified: true,
              vpHolder: cachedVerification.holder,
              vcCount: cachedVerification.vcCount,
            };

            this.logger.log(`✅ WebSocket auth success (VP cached): ${payload.address}`);
            return next();
          }

          // 3-2. Cache miss - Full VP verification
          this.logger.debug(`VP cache miss for WebSocket: ${payload.address}`);

          try {
            const vpVerification = await this.authService.verifyPresentation(vpJwt);

            if (!vpVerification || !vpVerification.verified) {
              this.logger.warn(`VP verification failed for WebSocket`);
              return next(new Error('VP verification failed'));
            }

            // VP holder 매칭 확인
            const vpHolder = vpVerification.holder?.replace('did:ethr:besu:', '');
            if (vpHolder?.toLowerCase() !== payload.address?.toLowerCase()) {
              this.logger.warn(`VP holder mismatch: ${vpHolder} vs ${payload.address}`);
              return next(new Error('VP holder mismatch'));
            }

            this.logger.log(`VP verified successfully for WebSocket: ${payload.address}`);

            // 검증 결과 캐싱
            await this.tokenService.cacheVPVerification(
              token,
              {
                verified: true,
                holder: vpVerification.holder,
                vcCount: vpVerification.verifiableCredential?.length || 0,
                verifiedAt: Date.now(),
              },
              3600, // 1 hour
            );

            socket.data.user = {
              address: payload.address,
              isGuardian: payload.isGuardian,
              vpVerified: true,
              vpHolder: vpVerification.holder,
              vcCount: vpVerification.verifiableCredential?.length || 0,
            };

            this.logger.log(`✅ WebSocket auth success (VP verified): ${payload.address}`);
            return next();
          } catch (error) {
            this.logger.error(`VP verification error: ${error.message}`);
            return next(new Error(`VP verification error: ${error.message}`));
          }
        } else {
          // VP 없음 - 허용하되 미인증 상태로 표시
          this.logger.warn(`No VP found for WebSocket token`);

          socket.data.user = {
            address: payload.address,
            isGuardian: payload.isGuardian,
            vpVerified: false,
          };

          this.logger.log(`⚠️  WebSocket auth success (No VP): ${payload.address}`);
          return next();
        }
      } catch (error) {
        this.logger.error(`WebSocket authentication error: ${error.message}`);
        this.logger.error(`Error stack: ${error.stack}`);
        return next(new Error('Authentication failed'));
      }
    });
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

          // 메시지 파싱 (Spring에서 이중 직렬화된 경우 처리)
          let parsedMessage = JSON.parse(message);

          // 이중 직렬화된 경우 한 번 더 파싱
          if (typeof parsedMessage === 'string') {
            parsedMessage = JSON.parse(parsedMessage);
          }

          this.logger.debug(`Parsed broadcast message: ${JSON.stringify(parsedMessage)}`);

          // 필드명 매핑 (chatSenderId -> senderId)
          const messageData = {
            senderId: parsedMessage.chatSenderId || parsedMessage.senderId,
            message: parsedMessage.message,
            roomId: parsedMessage.roomId,
            createdAt: parsedMessage.createdAt || new Date().toISOString(),
          };

          // Socket.io 방으로 브로드캐스트
          this.server.to(`room:${roomId}`).emit('message', messageData);
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

    this.logger.debug(`handleConnection called for client ${client.id}`);
    this.logger.debug(`client.data: ${JSON.stringify(client.data)}`);

    if (!user) {
      this.logger.warn(`Unauthorized connection attempt - No user data found`);
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
    @MessageBody() dto: LeaveRoomDto,
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

# Spring 채팅 서버 분석 보고서

## 📋 개요

Spring 채팅 서버는 **Redis Pub/Sub + STOMP** 기반의 실시간 채팅 시스템입니다.
- **인증**: 지갑 주소(walletAddress) 기반
- **실시간 통신**: Redis Pub/Sub
- **영속성**: JPA/MySQL
- **프로토콜**: STOMP over WebSocket (주석 처리된 부분 포함)

---

## 🏗️ 아키텍처 구조

### 현재 구조
```
클라이언트
   ↓ HTTP (REST API)
Spring Controller
   ↓
Service Layer
   ↓
├─ Redis Pub/Sub ← (외부에서 publish 가능)
└─ JPA/MySQL
```

### Redis Pub/Sub 흐름
```
외부 Publisher (예: NestJS)
   ↓ publish to "chat" channel
Redis
   ↓ subscribe
RedisPubSubService.onMessage()
   ↓ 역직렬화 (ChatMessageReqDTO)
   ↓ STOMP로 재발행
redisTemplate.convertAndSend("/topic/{roomId}", message)
```

---

## 📂 코드 구조 분석

### 1. Config & Infrastructure

#### RedisConfig.java
```java
// 핵심 설정
- Redis 연결: Lettuce 사용
- RedisTemplate: 객체 직렬화 (Jackson)
- StringRedisTemplate: 채팅용
- MessageListenerContainer: "chat" 채널 구독
- MessageListenerAdapter: RedisPubSubService.onMessage() 연결
```

**중요 포인트:**
- Line 74: `new PatternTopic("chat")` → **"chat" 채널을 구독**
- Line 81: `redisPubSubService.onMessage()` 호출

#### RedisPubSubService.java
```java
// Redis 구독자 & Publisher
publish(channel, message)  // 외부로 발행
onMessage(message, pattern) // "chat" 채널에서 수신
```

**핵심 로직 (Line 28-48):**
1. Redis에서 메시지 수신 (`ChatMessageReqDTO` JSON)
2. 역직렬화 (`objectMapper.readValue()`)
3. STOMP destination으로 재발행: `/topic/{roomId}`

**통합 포인트:**
✅ NestJS가 Redis "chat" 채널로 `ChatMessageReqDTO` 형식의 JSON을 publish하면 자동 처리됨

---

### 2. Entity 구조

#### ChatRoom (채팅방)
```java
- id: Long
- roomName: String
- roomStatus: OPEN/CLOSED
- initiatorId: String (채팅 시작자 지갑 주소)
- targetId: String (상대방 지갑 주소)
- adopt: Adopt (입양 공고 - 비즈니스 도메인)
- participants: List<ChatParticipant>
- chatMessages: List<ChatMessage>
```

**특징:**
- 1:1 채팅 (initiator ↔ target)
- 입양 공고(Adopt)와 연결
- 같은 공고 + 같은 두 유저면 중복 방지

#### ChatMessage (메시지)
```java
- id: Long
- chatMessage: String
- participant: ChatParticipant
- member: Member
- chatRoom: ChatRoom
- createdAt: LocalDateTime
```

#### ChatParticipant (참여자)
```java
- id: Long
- member: Member
- chatRoom: ChatRoom
- chatMessages: List<ChatMessage>
```

#### ChatReadStatus (읽음 상태)
```java
- id: Long
- chatMessage: ChatMessage
- member: Member
- chatRoom: ChatRoom
- isRead: boolean
```

**읽음 처리 로직:**
- 메시지 1개 → 읽음 상태 2개 (참여자 수만큼)
- 보낸 사람은 자동으로 `isRead = true`

---

### 3. DTO

#### ChatReqDTO.ChatMessageReqDTO ⭐ (NestJS가 사용할 형식)
```java
{
  "roomId": Long,
  "chatSenderId": String,  // 지갑 주소
  "message": String
}
```

#### ChatReqDTO.ChatRoomCreateDTO
```java
{
  "adoptWriterId": String,
  "adoptId": Long,
  "roomName": String
}
```

#### ChatResDTO.ChatMessageResDTO
```java
{
  "adoptId": Long,
  "messageId": Long,
  "senderId": String,
  "senderName": String,
  "message": String,
  "isRead": boolean
}
```

---

### 4. Controller (REST API)

#### ChatController.java

| Endpoint | Method | 설명 | 인증 |
|----------|--------|------|------|
| `/api/chat/room/create` | POST | 채팅방 생성 | @CurrentWalletAddress |
| `/api/chat/{roomId}/enter` | POST | 채팅방 입장 & 메시지 조회 | @CurrentWalletAddress |
| `/api/chat/room/card` | GET | 채팅방 카드 단일 조회 | @CurrentWalletAddress |
| `/api/chat/room/list` | GET | 채팅방 목록 조회 | @CurrentWalletAddress |
| `/api/chat/room/{roomId}/adoption` | GET | 입양 공고 정보 조회 | - |

**인증 방식:**
- `@CurrentWalletAddress String walletAddress` → Spring 커스텀 어노테이션
- JWT에서 지갑 주소 추출

---

### 5. Service Layer

#### ChatMessageCommandService
- `saveMessage(ChatMessageReqDTO)`: 메시지 저장 + 읽음 상태 생성
- `enterRoom(roomId, memberId)`: 메시지 조회 + 읽음 처리
- `markAsReadCount(roomId, memberId)`: 읽음 상태 업데이트

#### ChatRoomQueryService
- `findExistingRoom()`: 중복 채팅방 방지
- `getChatRoom(roomId)`: 채팅방 조회
- `getChatRoomCard()`: 채팅방 카드 (이름, 마지막 메시지, 미읽음 수)
- `getChatRoomCards()`: 채팅방 목록

#### ChatParticipantQueryService
- `isRoomParticipant(memberId, roomId)`: 참여자 권한 확인 ⭐
- `getTargetMember()`: 상대방 조회
- `findByMemberIdAndChatRoomId()`: 참여자 조회

#### ChatEntryService (STOMP 인증 - 주석 처리됨)
```java
// connectSocket() - STOMP CONNECT 시 JWT 검증 (주석 처리)
subscribeSocket() - STOMP SUBSCRIBE 시 권한 검증
```

**중요:**
- Line 26-41: `connectSocket()` 주석 처리 → **STOMP 인증 비활성화 상태**
- Line 43-61: `subscribeSocket()` 활성화 → 방 참여 권한 검증

---

## 🔗 NestJS 통합 방안

### 현재 상황
- **NestJS**: Socket.io 기반, 인증/인가 처리
- **Spring**: Redis 구독 + DB 저장 + (STOMP 비활성화)

### 통합 아키텍처 (추천)

```
클라이언트 (웹/앱)
   ↓ Socket.io
NestJS Gateway
   ↓ JWT 검증 → 지갑 주소 추출
   ↓
   ├─ Redis Pub/Sub ("chat" 채널)
   │    ↓
   │  Spring RedisPubSubService
   │    ↓
   │  Spring DB 저장 (ChatMessage, ChatReadStatus)
   │
   └─ Spring REST API 호출 (권한 체크)
        - isRoomParticipant()
        - getChatRoom()
```

---

## 🎯 통합 시나리오

### 1️⃣ 클라이언트 연결 (WebSocket Handshake)
```
Client → NestJS Gateway
- Authorization: Bearer <JWT>
- NestJS: JWT 검증 → 지갑 주소 추출
- socket.data.user = { address: '0x...' }
```

### 2️⃣ 채팅방 입장 (joinRoom)
```javascript
// 클라이언트
socket.emit('joinRoom', { roomId: 1 })

// NestJS Gateway
1. user.address 확인
2. Spring REST API 호출: GET /api/chat/room/check-permission
   - Query: { roomId: 1, walletAddress: '0x...' }
3. Spring ChatParticipantQueryService.isRoomParticipant() 확인
4. 권한 있으면 → socket.join('room:1')
5. Redis 채널 구독: chat:room:1
```

**Spring에 필요한 새 엔드포인트:**
```java
@GetMapping("/room/check-permission")
public CustomResponse<Boolean> checkPermission(
    @RequestParam Long roomId,
    @RequestParam String walletAddress
) {
    boolean canJoin = chatParticipantQueryService.isRoomParticipant(walletAddress, roomId);
    return CustomResponse.onSuccess(canJoin);
}
```

### 3️⃣ 메시지 전송
```javascript
// 클라이언트
socket.emit('sendMessage', { roomId: 1, message: 'Hello' })

// NestJS Gateway
1. user.address 확인
2. Redis "chat" 채널에 publish:
   {
     "roomId": 1,
     "chatSenderId": "0x123...",  // ← 지갑 주소
     "message": "Hello"
   }

// Spring RedisPubSubService.onMessage()
1. Redis에서 수신 (자동)
2. ChatMessageReqDTO 역직렬화
3. DB 저장 (ChatMessage, ChatReadStatus)
4. STOMP로 재발행: /topic/1
```

### 4️⃣ 메시지 수신
```
Spring Redis → NestJS Redis Subscriber
NestJS: socket.to('room:1').emit('message', messageData)
Client: socket.on('message', (data) => { ... })
```

---

## ✅ Spring 코드 수정 최소화 전략

### ❌ 수정 불필요 (그대로 사용)
- ✅ Entity 구조 (ChatRoom, ChatMessage 등)
- ✅ Repository
- ✅ Service (Command/Query)
- ✅ RedisPubSubService (핵심!)
- ✅ DTO 구조 (ChatReqDTO.ChatMessageReqDTO)

### ⚠️ 수정 필요 (1개 파일만)
- **ChatController.java**
  - 새 엔드포인트 추가: `/room/check-permission`

```java
@GetMapping("/room/check-permission")
public CustomResponse<CheckPermissionResDTO> checkPermission(
    @RequestParam Long roomId,
    @RequestParam String walletAddress
) {
    boolean canJoin = chatParticipantQueryService.isRoomParticipant(walletAddress, roomId);
    return CustomResponse.onSuccess(
        new CheckPermissionResDTO(canJoin)
    );
}

@Data
@AllArgsConstructor
static class CheckPermissionResDTO {
    private boolean canJoin;
}
```

---

## 🔑 핵심 통합 포인트

### 1. Redis 채널명 일치
- **Spring 구독**: `"chat"` (RedisConfig.java:74)
- **NestJS 발행**: `"chat"` 채널 사용

### 2. 메시지 형식 일치
**NestJS가 publish할 JSON:**
```json
{
  "roomId": 1,
  "chatSenderId": "0x1234567890abcdef",
  "message": "Hello"
}
```

**Spring이 기대하는 형식:**
```java
ChatReqDTO.ChatMessageReqDTO {
  Long roomId;
  String chatSenderId;  // ← 지갑 주소
  String message;
}
```

### 3. 지갑 주소 전달
- **NestJS**: JWT → `socket.data.user.address`
- **Spring**: `chatSenderId` 필드로 수신
- **DB**: `Member` 테이블에서 지갑 주소로 회원 조회

---

## 🚧 현재 Spring 코드의 한계

### 1. STOMP 인증 비활성화
- `ChatEntryService.connectSocket()` 주석 처리됨
- 현재는 STOMP 연결 시 인증 없음

**해결 방안:**
- NestJS에서 인증 처리하므로 문제 없음
- STOMP는 Spring 내부에서만 사용 (외부 노출 안 함)

### 2. Member 엔티티 의존성
- `ChatMessage`, `ChatParticipant`가 `Member` 필요
- 지갑 주소로 Member를 찾아야 함

**필요 조건:**
- Spring에 지갑 주소가 이미 `Member`로 등록되어 있어야 함
- 없으면 `MEMBER_NOTFOUND` 에러 발생

### 3. 채팅방 생성 API 제한
- `/room/create` API는 입양 공고(`Adopt`) 필요
- NestJS에서 직접 호출 가능하지만 Adopt 필요

---

## 📝 NestJS 수정 계획

### src/chat/chat.service.ts
```typescript
async sendMessage(walletAddress: string, dto: SendMessageDto) {
  const chatMessage = {
    roomId: dto.roomId,
    chatSenderId: walletAddress,  // ← Spring 형식
    message: dto.message,
  };

  // Redis "chat" 채널로 publish
  await this.redisService.publish('chat', JSON.stringify(chatMessage));
}
```

### src/chat/chat.gateway.ts
```typescript
@SubscribeMessage('joinRoom')
async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() dto: JoinRoomDto) {
  const user = client.data.user;

  // Spring API 호출로 권한 확인
  const canJoin = await this.chatService.canJoinRoom(user.address, dto.roomId);

  if (!canJoin) {
    return { success: false, error: 'No permission' };
  }

  await client.join(`room:${dto.roomId}`);
  // Redis 구독은 Spring이 하므로 NestJS는 불필요
}
```

---

## 🎯 다음 단계

### 1단계: Spring에 권한 체크 API 추가
- [ ] `ChatController.checkPermission()` 엔드포인트 추가

### 2단계: NestJS 코드 수정
- [ ] `chat.service.ts`: Redis "chat" 채널 사용
- [ ] `chat.gateway.ts`: Spring REST API 호출
- [ ] DTO 형식 변경: `chatSenderId` 사용

### 3단계: Redis 채널 통합 테스트
- [ ] NestJS → Redis → Spring 메시지 흐름 확인
- [ ] Spring DB 저장 확인

### 4단계: 실시간 브로드캐스트 확인
- [ ] Spring STOMP → NestJS Redis 구독
- [ ] NestJS Socket.io → 클라이언트 전달

---

## 💡 결론

**현재 Spring 코드는 NestJS 통합에 최적화되어 있습니다!**

✅ Redis Pub/Sub 이미 구현됨
✅ 지갑 주소 기반 인증 지원
✅ 최소 수정으로 통합 가능 (1개 API만 추가)

**통합 원칙:**
1. **NestJS**: 인증/인가 + 실시간 통신 (Socket.io)
2. **Spring**: 비즈니스 로직 + 영속성
3. **Redis**: 메시지 브로커

이 구조는 **하이브리드 방식 + BFF 패턴**으로, API Gateway의 역할을 확장한 현대적 아키텍처입니다!

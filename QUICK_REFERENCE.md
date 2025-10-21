# 채팅 시스템 빠른 참조 가이드

## 🎯 아키텍처 요약

```
┌─────────────┐
│  Frontend   │ Socket.io (WebSocket) - 실시간 메시지
│  (Next.js)  │ REST API - 채팅방 관리
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│  NestJS API Gateway (Port 3000)                 │
│  - VP 인증/인가                                   │
│  - Socket.io 서버 (WebSocket)                    │
│  - Redis Pub/Sub (브로커)                        │
└──────┬──────────────────────────┬───────────────┘
       │ Redis "chat"             │ Redis "nestjs:broadcast:*"
       ▼                          ▼
┌─────────────────────────────────────────────────┐
│  Spring Backend (Port 8080)                     │
│  - 채팅 비즈니스 로직                              │
│  - DB 영속성 (MySQL/PostgreSQL)                  │
│  - Redis Subscriber                             │
└─────────────────────────────────────────────────┘
```

---

## 📡 API 엔드포인트

### NestJS API Gateway (REST)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/api/chat/room/create` | 채팅방 생성 | ✅ |
| GET | `/api/chat/room/list` | 내 채팅방 목록 | ✅ |
| GET | `/api/chat/room/card?roomId=1` | 채팅방 카드 정보 | ✅ |
| POST | `/api/chat/:roomId/enter` | 메시지 히스토리 조회 | ✅ |
| GET | `/api/chat/room/:roomId/adoption` | 채팅방 연결 입양 게시 | ✅ |

### NestJS WebSocket (Socket.io)

| Event | Direction | Payload | Response | 설명 |
|-------|-----------|---------|----------|------|
| `joinRoom` | Client → Server | `{ roomId: 1 }` | `{ success: true, messages: [...] }` | 채팅방 입장 + 히스토리 |
| `sendMessage` | Client → Server | `{ roomId: 1, message: "Hi" }` | `{ success: true, data: {...} }` | 메시지 전송 |
| `leaveRoom` | Client → Server | `{ roomId: 1 }` | `{ success: true }` | 채팅방 퇴장 |
| `message` | Server → Client | `{ senderId, message, createdAt, isRead }` | - | 실시간 메시지 수신 |

---

## 💻 프론트엔드 코드 예시

### Socket.io 연결

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  auth: {
    token: jwtToken  // VP 인증 JWT 토큰
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

### 채팅방 입장 (메시지 히스토리 자동 조회)

```typescript
socket.emit('joinRoom', { roomId: 1 }, (response) => {
  if (response.success) {
    console.log('입장 성공!');

    // 메시지 히스토리 표시
    response.messages.forEach(msg => {
      addMessageToUI({
        sender: msg.senderId,
        message: msg.message,
        timestamp: msg.createdAt,
        isRead: msg.isRead
      });
    });
  }
});
```

### 메시지 전송

```typescript
socket.emit('sendMessage', {
  roomId: 1,
  message: '안녕하세요!'
}, (response) => {
  if (response.success) {
    console.log('전송 완료!');
  }
});
```

### 실시간 메시지 수신

```typescript
socket.on('message', (data) => {
  addMessageToUI({
    sender: data.senderId,
    message: data.message,
    timestamp: data.createdAt,
    isRead: data.isRead
  });
});
```

### 채팅방 생성 (REST API)

```typescript
const response = await fetch('http://localhost:3000/api/chat/room/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    adoptWriterId: '0xABC...',  // 입양 공고 글쓴이
    adoptId: 123,               // 입양 공고 ID
    roomName: '골든 리트리버 입양 문의'
  })
});

const { result } = await response.json();
const roomId = result.roomId;
```

---

## 🔄 메시지 흐름

### 메시지 전송 시

```
1. Client A: socket.emit('sendMessage', {roomId: 1, message: 'Hello'})
   ↓
2. NestJS: ChatGateway.handleSendMessage()
   ↓ Redis PUBLISH "chat"
3. Spring: RedisPubSubService.onMessage()
   ↓ DB 저장
4. Spring: DB.save(ChatMessage)
   ↓ Redis PUBLISH "nestjs:broadcast:1"
5. NestJS: ChatGateway.pmessage handler
   ↓ Socket.io broadcast
6. Client A, B: socket.on('message', ...) → 'Hello' 수신
```

### 채팅방 입장 시

```
1. Client: socket.emit('joinRoom', {roomId: 1})
   ↓
2. NestJS: ChatGateway.handleJoinRoom()
   ├─ canJoinRoom() → Spring: /room/check-permission ✅
   ├─ client.join('room:1') → Socket.io room 입장 ✅
   └─ enterRoom() → Spring: /chat/1/enter
      ├─ getChatMessages() → 메시지 히스토리 조회
      └─ markAsReadCount() → 읽음 처리
   ↓
3. Client: { success: true, messages: [...] } 수신
```

---

## 🗃️ 데이터베이스 스키마 (Spring)

### chat_room (채팅방)

| Column | Type | 설명 |
|--------|------|------|
| room_id | BIGINT | 채팅방 ID (PK) |
| initiator_id | VARCHAR | 문의자 (채팅 시작한 사람) |
| target_id | VARCHAR | 글쓴이 (채팅 대상) |
| adopt_id | BIGINT | 입양 공고 ID (FK) |
| room_name | VARCHAR | 채팅방 이름 |
| created_at | TIMESTAMP | 생성일시 |

### chat_participant (채팅 참여자)

| Column | Type | 설명 |
|--------|------|------|
| participant_id | BIGINT | 참여자 ID (PK) |
| room_id | BIGINT | 채팅방 ID (FK) |
| member_id | VARCHAR | 참여자 지갑 주소 |
| joined_at | TIMESTAMP | 참여일시 |

### chat_message (채팅 메시지)

| Column | Type | 설명 |
|--------|------|------|
| message_id | BIGINT | 메시지 ID (PK) |
| room_id | BIGINT | 채팅방 ID (FK) |
| sender_id | VARCHAR | 발신자 지갑 주소 |
| message | TEXT | 메시지 내용 |
| is_read | BOOLEAN | 읽음 여부 |
| created_at | TIMESTAMP | 전송일시 |

---

## 🔧 환경 변수 설정

### NestJS (.env)

```env
# Server
PORT=3000

# Spring Backend
SPRING_URL=http://localhost:8080

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
```

### Spring (application.yml)

```yaml
spring:
  redis:
    host: localhost
    port: 6379
  datasource:
    url: jdbc:mysql://localhost:3306/dogcatpaw
    username: root
    password: password
```

---

## 🧪 빠른 테스트

### 1. 서비스 시작

```bash
# Redis
redis-server

# NestJS
cd dogcatpaw-api-gateway
npm run start:dev

# Spring
cd dogcatpaw-spring
./gradlew bootRun
```

### 2. 기본 채팅 테스트

```bash
# 1. USER_B 정보 수정
vim test-adoption-chat-integration.js

# 2. 테스트 실행
node test-adoption-chat-integration.js
```

### 3. Redis 모니터링

```bash
redis-cli
> MONITOR
```

---

## ❌ 문제 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| Socket 연결 실패 | JWT 토큰 없음/만료 | `/api/auth/login`으로 토큰 재발급 |
| 채팅방 입장 거부 | 참여자가 아님 | `chat_participant` 테이블 확인 |
| 메시지 미수신 | Redis 구독 실패 | Spring 로그에서 `psubscribe` 확인 |
| 메시지 저장 안됨 | DB 연결 실패 | Spring DataSource 설정 확인 |
| 브로드캐스트 실패 | 채널명 불일치 | `nestjs:broadcast:{roomId}` 확인 |

---

## 📚 주요 파일 위치

### NestJS

```
src/
├─ chat/
│  ├─ chat.gateway.ts       # WebSocket 이벤트 핸들러
│  ├─ chat.service.ts        # 채팅 비즈니스 로직
│  └─ dto/
│     └─ chat-message.dto.ts # DTO 정의
├─ spring/
│  ├─ spring.controller.ts   # REST API 프록시
│  └─ spring.proxy.service.ts # Spring API 호출
└─ common/
   └─ redis/
      └─ redis.service.ts    # Redis Pub/Sub
```

### Spring

```
src/main/java/com/project/dogcatpaw/chat/
├─ controller/
│  └─ ChatController.java           # REST API
├─ service/
│  ├─ ChatMessageCommandService.java # 메시지 저장/조회
│  └─ RedisPubSubService.java       # Redis Pub/Sub
├─ domain/
│  ├─ ChatRoom.java
│  ├─ ChatMessage.java
│  └─ ChatParticipant.java
└─ repository/
   ├─ ChatRoomRepository.java
   ├─ ChatMessageRepository.java
   └─ ChatParticipantRepository.java
```

---

## 🎯 핵심 개념

### 1. 왜 Socket.io를 사용하나?

- ✅ **WebSocket + HTTP Long Polling** 폴백 지원
- ✅ **자동 재연결** 및 **이벤트 기반 통신**
- ✅ **Room 관리** 내장 (채팅방 브로드캐스트)
- ✅ **프론트엔드 친화적** (NPM 8M+ 다운로드)

### 2. 왜 Redis Pub/Sub인가?

- ✅ **MSA 아키텍처**에서 서비스 간 통신
- ✅ **NestJS ↔ Spring** 느슨한 결합
- ✅ **고성능** (초당 수만 건 처리)
- ✅ **확장 가능** (Redis Cluster 지원)

### 3. 왜 Spring에서 DB 저장?

- ✅ **비즈니스 로직 분리** (채팅 규칙, 권한 관리)
- ✅ **배치 처리** (Memory Queue → DB 일괄 저장)
- ✅ **트랜잭션 관리** (메시지 저장 + 읽음 처리)

### 4. joinRoom에서 메시지 히스토리를 왜 자동 조회?

- ✅ **클라이언트 단순화** (1번 호출로 완료)
- ✅ **사용자 경험 향상** (입장과 동시에 메시지 표시)
- ✅ **읽음 처리 자동화** (입장 = 읽음)

---

## 🚀 프로덕션 체크리스트

### 보안
- [ ] JWT 토큰 만료 시간 설정 (1시간 권장)
- [ ] Redis 비밀번호 설정
- [ ] CORS 도메인 제한
- [ ] Rate Limiting 적용

### 성능
- [ ] Redis 커넥션 풀 설정
- [ ] DB 인덱스 최적화 (room_id, sender_id, created_at)
- [ ] 메시지 히스토리 페이지네이션 (최대 100개)
- [ ] Socket.io 클라이언트 수 모니터링

### 모니터링
- [ ] NestJS 로그 (Winston)
- [ ] Spring 로그 (Logback)
- [ ] Redis MONITOR (개발 환경만)
- [ ] DB 슬로우 쿼리 로그

### 백업
- [ ] DB 정기 백업 (채팅 메시지 보관 정책)
- [ ] Redis AOF/RDB 설정

---

**작성일:** 2025-10-21
**버전:** 1.0
**문의:** CHAT_INTEGRATION_SUMMARY.md 참고

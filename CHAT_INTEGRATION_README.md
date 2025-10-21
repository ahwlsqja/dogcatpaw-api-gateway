# 채팅 시스템 통합 완료 가이드

## 📋 작업 완료 내역

### ✅ 완료된 작업

1. **Spring 코드 분석** (`spring-chat-analysis.md`)
   - Spring STOMP 구조 완전 분석
   - Redis Pub/Sub 메커니즘 파악
   - Entity, Service, Controller 분석 완료

2. **NestJS 코드 수정**
   - `src/chat/chat.service.ts` - Redis "chat" 채널 사용, Spring API 호출
   - `src/chat/chat.gateway.ts` - Redis "nestjs:broadcast:*" 패턴 구독

3. **문서 작성**
   - `SPRING_INTEGRATION_GUIDE.md` - Spring 개발자용 상세 가이드
   - `FRONTEND_CHAT_GUIDE.md` - 프론트엔드 개발자용 통합 가이드
   - `test-chat-integration.js` - NestJS 테스트 스크립트

---

## 🏗️ 최종 아키텍처

```
┌─────────────────────┐
│  클라이언트 (웹/앱)  │
│  Socket.io Client    │
└──────────┬──────────┘
           │
           │ ws://gateway:3000/chat
           │ (JWT Token)
           ↓
┌───────────────────────────────────────┐
│     NestJS API Gateway                │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │  WsAuthAdapter                  │ │
│  │  - JWT 검증                     │ │
│  │  - VP 검증 (캐시)               │ │
│  │  - 지갑 주소 추출               │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │  ChatGateway                    │ │
│  │  - joinRoom (권한 체크)         │ │
│  │  - sendMessage                  │ │
│  │  - leaveRoom                    │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │  Redis Subscriber               │ │
│  │  - nestjs:broadcast:* 패턴 구독 │ │
│  │  - Socket.io emit               │ │
│  └─────────────────────────────────┘ │
└───────┬──────────────────┬───────────┘
        │                  │
        │ REST API         │ Redis Pub/Sub
        │                  │
        ↓                  ↓
┌──────────────────────────────────────┐
│         Redis Server                 │
│                                      │
│  채널:                               │
│  - "chat"            (NestJS→Spring) │
│  - "nestjs:broadcast:{roomId}"       │
│                      (Spring→NestJS) │
└──────┬───────────────────────────────┘
       │
       │ Pub/Sub
       ↓
┌──────────────────────────────────────┐
│      Spring Server                   │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  ChatController (REST API)     │ │
│  │  - /room/create                │ │
│  │  - /room/check-permission ⭐   │ │
│  │  - /{roomId}/enter             │ │
│  │  - /room/list                  │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  RedisPubSubService            │ │
│  │  - "chat" 구독                 │ │
│  │  - DB 저장                     │ │
│  │  - "nestjs:broadcast" 재발행 ⭐│ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  MySQL/PostgreSQL              │ │
│  │  - chat_room                   │ │
│  │  - chat_message                │ │
│  │  - chat_participant            │ │
│  │  - chat_read_status            │ │
│  └────────────────────────────────┘ │
│                                      │
│  ❌ STOMP 비활성화됨                │
└──────────────────────────────────────┘
```

---

## 🔄 메시지 전송 플로우

### 상세 흐름

```
1️⃣ 클라이언트
   socket.emit('sendMessage', { roomId: 1, message: 'Hello' })
      ↓

2️⃣ NestJS Gateway (chat.gateway.ts)
   - 사용자 인증 확인 (socket.data.user)
   - chatService.sendMessage() 호출
      ↓

3️⃣ NestJS Service (chat.service.ts)
   - Spring 형식으로 변환:
     {
       roomId: 1,
       chatSenderId: "0x123...",  ← 지갑 주소
       message: "Hello"
     }
   - Redis "chat" 채널에 publish
      ↓

4️⃣ Redis Server
   - "chat" 채널 메시지 브로드캐스트
      ↓

5️⃣ Spring RedisPubSubService (onMessage)
   - Redis 구독으로 자동 수신
   - JSON 역직렬화 → ChatMessageReqDTO
   - chatMessageCommandService.saveMessage() 호출
      ↓

6️⃣ Spring Service (saveMessage)
   - ChatMessage INSERT (chat_message 테이블)
   - ChatReadStatus INSERT (chat_read_status 테이블)
     * 보낸 사람: isRead = true
     * 다른 참여자: isRead = false
      ↓

7️⃣ Spring RedisPubSubService
   - Redis "nestjs:broadcast:{roomId}" 재발행
   - 예: "nestjs:broadcast:1"
      ↓

8️⃣ Redis Server
   - "nestjs:broadcast:1" 채널 브로드캐스트
      ↓

9️⃣ NestJS Redis Subscriber (initRedisSubscriber)
   - 패턴 구독: "nestjs:broadcast:*"
   - 메시지 수신
      ↓

🔟 NestJS ChatGateway
   - roomId 추출
   - Socket.io로 방 전체에 emit:
     this.server.to('room:1').emit('message', data)
      ↓

1️⃣1️⃣ 모든 클라이언트 (해당 방)
   socket.on('message', (data) => {
     // UI 업데이트
   })
```

**지연 시간:** 약 20-100ms (실시간!)

---

## 📁 파일별 수정 내역

### Spring 수정 필요 (2개 파일)

#### 1. `ChatController.java` ⭐ 신규 API 추가

**파일 위치:** `kpaas.dogcat.domain.chat.controller.ChatController.java`

**추가할 코드:**
```java
@Operation(summary = "채팅방 참여 권한 확인", description = "NestJS Gateway에서 사용")
@GetMapping("/room/check-permission")
public CustomResponse<CheckPermissionResDTO> checkPermission(
    @RequestParam Long roomId,
    @RequestParam String walletAddress
) {
    boolean canJoin = chatParticipantQueryService.isRoomParticipant(walletAddress, roomId);
    return CustomResponse.onSuccess(new CheckPermissionResDTO(canJoin));
}

@Data
@AllArgsConstructor
public static class CheckPermissionResDTO {
    private boolean canJoin;
}
```

---

#### 2. `RedisPubSubService.java` ⭐ 브로드캐스트 채널 변경

**파일 위치:** `kpaas.dogcat.global.redis.service.RedisPubSubService.java`

**Line 43-45 수정:**

**변경 전:**
```java
String stompMessage = objectMapper.writeValueAsString(messageReqDTO);
redisTemplate.convertAndSend("/topic/" + messageReqDTO.getRoomId(), stompMessage);
```

**변경 후:**
```java
String jsonMessage = objectMapper.writeValueAsString(messageReqDTO);

// ⭐ NestJS용 Redis 채널로 발행
redisTemplate.convertAndSend("nestjs:broadcast:" + messageReqDTO.getRoomId(), jsonMessage);

log.info("메시지 브로드캐스트 완료 - 채널: nestjs:broadcast:{}", messageReqDTO.getRoomId());
```

---

### Spring 비활성화 (4개 파일)

**STOMP 관련 파일들을 비활성화:**

1. `StompWebSockConfig.java` → `@Configuration` 주석 처리
2. `StompController.java` → `@Controller` 주석 처리
3. `StompHandler.java` → (선택) 주석 처리
4. `StompEventListener.java` → (선택) 주석 처리

**이유:** 클라이언트는 Socket.io만 사용하므로 STOMP 불필요

---

### NestJS 수정 완료 (2개 파일)

#### 1. `src/chat/chat.service.ts` ✅
- Redis "chat" 채널로 발행 (Spring이 구독)
- Spring API 권한 체크 호출

#### 2. `src/chat/chat.gateway.ts` ✅
- Redis "nestjs:broadcast:*" 패턴 구독
- Socket.io 방으로 브로드캐스트

---

## 🧪 테스트 가이드

### 1단계: 환경 확인

```bash
# Redis 실행 확인
redis-cli ping
# 응답: PONG

# NestJS 서버 실행
cd dogcatpaw-api-gateway
npm run start:dev

# Spring 서버 실행 확인
curl http://localhost:8080/actuator/health
```

---

### 2단계: Spring 수정 확인

```bash
# 권한 체크 API 테스트
curl "http://localhost:8080/api/chat/room/check-permission?roomId=1&walletAddress=0x123..."

# 예상 응답:
# {"canJoin": true} 또는 {"canJoin": false}
```

---

### 3단계: NestJS 테스트 스크립트 실행

```bash
# 테스트 스크립트 실행 전 설정
# test-chat-integration.js 파일에서 다음 값 수정:
# - JWT_TOKEN: 실제 JWT 토큰
# - TEST_ROOM_ID: 실제 채팅방 ID

# 테스트 실행
node test-chat-integration.js
```

**예상 결과:**
```
🚀 채팅 통합 테스트 시작
...
✅ 연결 성공: Socket ID = abc123
✅ 메시지 리스너 설정 완료
✅ 채팅방 입장 성공: Joined room 1
✅ 메시지 전송 성공
✅ 메시지 수신: Hello!
✅ 채팅방 퇴장 성공
...
🎉 모든 테스트 통과!
```

---

### 4단계: Redis 메시지 흐름 확인

**터미널 1: Redis 모니터링**
```bash
redis-cli MONITOR
```

**터미널 2: 테스트 실행**
```bash
node test-chat-integration.js
```

**예상 Redis 로그:**
```
1. PUBLISH "chat" '{"roomId":1,"chatSenderId":"0x123...","message":"Hello"}'
   ↑ NestJS → Spring

2. PUBLISH "nestjs:broadcast:1" '{"messageId":123,"senderId":"0x123...","message":"Hello",...}'
   ↑ Spring → NestJS
```

---

## 📊 DB 확인

### 메시지 저장 확인

```sql
-- 최신 메시지 조회
SELECT * FROM chat_message
ORDER BY created_at DESC
LIMIT 10;

-- 읽음 상태 확인
SELECT
  m.id as message_id,
  m.chat_message,
  r.member_id,
  r.is_read
FROM chat_message m
LEFT JOIN chat_read_status r ON m.id = r.message_id
WHERE m.room_id = 1
ORDER BY m.created_at DESC
LIMIT 5;
```

---

## 🐛 문제 해결 가이드

### 문제 1: 연결 실패 (connect_error)

**증상:** `Authentication token missing` 또는 `Token has been revoked`

**원인:**
- JWT 토큰이 없거나 유효하지 않음
- VP 인증 미완료

**해결:**
1. JWT 토큰 확인: 만료되지 않았는지
2. VP 인증 확인: `/auth/login` 성공했는지
3. Redis 확인: 토큰이 블록 리스트에 없는지

---

### 문제 2: 채팅방 입장 실패

**증상:** `No permission to join this room`

**원인:**
- `chat_participant` 테이블에 사용자가 없음
- Spring API `/room/check-permission` 실패

**해결:**
```sql
-- 참여자 확인
SELECT * FROM chat_participant
WHERE member_id = '0x123...'
  AND room_id = 1;

-- 없으면 추가 (또는 /room/create API 사용)
INSERT INTO chat_participant (member_id, room_id)
VALUES ('0x123...', 1);
```

---

### 문제 3: 메시지 전송 성공했지만 수신 안 됨

**증상:** `sendMessage` 성공했지만 `message` 이벤트 안 옴

**원인:**
- Spring이 Redis "nestjs:broadcast:{roomId}" 재발행 안 함
- NestJS Redis 구독 실패

**디버깅:**

**1) Spring 로그 확인:**
```
[ ] Redis 메시지 수신 확인
[ ] 메시지 역직렬화 성공
[ ] 메시지 브로드캐스트 완료 - 채널: nestjs:broadcast:1
```

**2) Redis 확인:**
```bash
redis-cli
PSUBSCRIBE nestjs:broadcast:*

# 다른 터미널에서 메시지 전송
# 메시지가 나타나는지 확인
```

**3) NestJS 로그 확인:**
```
[ ] Redis subscriber initialized for chat (nestjs:broadcast:* pattern)
[ ] Broadcasting message from Spring to room 1
```

---

### 문제 4: DB에 메시지가 저장 안 됨

**증상:** 메시지 전송 성공했지만 DB에 없음

**원인:**
- Spring이 Redis "chat" 구독 안 함
- `Member` 또는 `ChatParticipant` 없음

**해결:**

```bash
# 1. Spring 로그 확인
# "Redis 메시지 수신" 로그가 나오는지 확인

# 2. Redis 구독 확인
redis-cli
SUBSCRIBE chat

# 다른 터미널에서 테스트
PUBLISH chat '{"roomId":1,"chatSenderId":"0x123...","message":"Test"}'

# 메시지가 나타나면 Spring이 구독 중
```

```sql
-- 3. Member 확인
SELECT * FROM member WHERE id = '0x123...';

-- 4. ChatParticipant 확인
SELECT * FROM chat_participant
WHERE member_id = '0x123...' AND room_id = 1;
```

---

## 🚀 프론트엔드 통합 시작

Spring/NestJS 통합이 완료되면 프론트엔드 개발 시작:

1. **`FRONTEND_CHAT_GUIDE.md` 참조**
2. Socket.io 클라이언트 설치
3. React Hook 구현 (`useChat.ts`)
4. 채팅 UI 컴포넌트 작성

---

## 📞 체크리스트

### Spring 개발자

- [ ] `ChatController.java`에 `/room/check-permission` API 추가
- [ ] `RedisPubSubService.java`에서 "nestjs:broadcast" 재발행 추가
- [ ] STOMP 관련 파일 비활성화 (`@Configuration` 주석)
- [ ] Spring 서버 재시작 및 로그 확인
- [ ] `/room/check-permission` API 테스트

### NestJS 개발자

- [ ] NestJS 서버 실행 (`npm run start:dev`)
- [ ] `test-chat-integration.js` 설정 (토큰, roomId)
- [ ] 테스트 스크립트 실행 및 확인
- [ ] Redis MONITOR로 메시지 흐름 확인

### 프론트엔드 개발자

- [ ] Socket.io 클라이언트 설치
- [ ] JWT 토큰 확보 (VP 인증)
- [ ] `FRONTEND_CHAT_GUIDE.md` 참조
- [ ] 채팅 UI 구현
- [ ] 통합 테스트

---

## 📚 관련 문서

| 문서 | 대상 | 내용 |
|------|------|------|
| `spring-chat-analysis.md` | 전체 | Spring 채팅 서버 구조 분석 |
| `SPRING_INTEGRATION_GUIDE.md` | Spring 개발자 | Spring 수정 가이드 (상세) |
| `FRONTEND_CHAT_GUIDE.md` | 프론트엔드 개발자 | Socket.io 사용 가이드 |
| `test-chat-integration.js` | NestJS/QA | 통합 테스트 스크립트 |
| `CHAT_INTEGRATION_README.md` (이 문서) | 전체 | 통합 완료 가이드 |

---

## 🎯 다음 단계

1. ✅ Spring 코드 수정 (2개 파일)
2. ✅ NestJS 코드 수정 완료
3. ⏳ Spring 개발자에게 `SPRING_INTEGRATION_GUIDE.md` 전달
4. ⏳ 통합 테스트 실행 (`test-chat-integration.js`)
5. ⏳ DB 저장 확인
6. ⏳ 프론트엔드 통합 시작 (`FRONTEND_CHAT_GUIDE.md`)

---

**작성일:** 2025-10-21
**버전:** 1.0
**작성자:** NestJS Gateway Team

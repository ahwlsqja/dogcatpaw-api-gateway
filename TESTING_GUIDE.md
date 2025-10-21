# 채팅 통합 테스트 가이드

## 📋 사전 준비

### 1. 필요한 서비스 실행

```bash
# NestJS API Gateway
npm run start:dev

# Spring 서버 (별도 터미널)
cd ../dogcatpaw-spring
./gradlew bootRun

# Redis 서버
# Windows: redis-server.exe
# macOS/Linux: redis-server
```

### 2. 필요한 NPM 패키지 설치

```bash
npm install socket.io-client ethers axios
```

### 3. 데이터 준비

- **User A (입양 공고 글쓴이)**: Pet이 등록되어 있어야 함
- **User B (입양 희망자)**: 회원 가입 필요 (walletAddress, privateKey 준비)

---

## 🧪 테스트 시나리오

### 테스트 1: 기본 채팅 통합 테스트

**파일:** `test-chat-integration.js`

**목적:** WebSocket 연결, 채팅방 입장, 메시지 전송/수신 테스트

**수정 필요:**
1. `JWT_TOKEN` - 실제 JWT 토큰으로 변경
2. `TEST_ROOM_ID` - 실제 채팅방 ID로 변경

**실행:**
```bash
node test-chat-integration.js
```

**테스트 내용:**
1. ✅ WebSocket 연결
2. ✅ 채팅방 입장 (joinRoom)
3. ✅ 메시지 히스토리 자동 조회
4. ✅ 메시지 전송 (sendMessage)
5. ✅ 실시간 브로드캐스트 수신
6. ✅ 채팅방 퇴장 (leaveRoom)

---

### 테스트 2: 입양 공고 + 채팅 통합 테스트 (E2E)

**파일:** `test-adoption-chat-integration.js`

**목적:** 입양 공고 작성부터 채팅까지 전체 플로우 테스트

**수정 필요:**
1. `USER_B.address` - User B의 지갑 주소
2. `USER_B.privateKey` - User B의 Private Key

**실행:**
```bash
node test-adoption-chat-integration.js
```

**테스트 내용:**
1. ✅ User A 로그인 (입양 공고 글쓴이)
2. ✅ User A - 입양 공고 작성
3. ✅ User B 로그인 (입양 희망자)
4. ✅ User B - 채팅방 생성 (입양 공고 연결)
5. ✅ User B - WebSocket 채팅방 입장 + 메시지 히스토리 자동 조회
6. ✅ User B - 메시지 전송
7. ✅ User A - WebSocket 채팅방 입장 및 메시지 수신
8. ✅ User A - 답장 전송
9. ✅ 채팅방 정보 조회 (카드, 입양 게시 정보)

**예상 결과:**
```
📊 테스트 결과 요약:
  ✅ 입양 공고 ID: 123
  ✅ 채팅방 ID: 45
  ✅ User A (글쓴이): 0x38fe...
  ✅ User B (입양 희망자): 0xYOUR...
  ✅ 주고받은 메시지: 2개

✨ 검증된 기능:
  1. 입양 공고 작성 ✅
  2. 채팅방 생성 (입양 공고 연결) ✅
  3. WebSocket 채팅방 입장 + 메시지 히스토리 자동 조회 ✅
  4. 메시지 전송 (Redis Pub/Sub → Spring → DB) ✅
  5. 실시간 메시지 브로드캐스트 ✅
  6. 읽음 처리 (markAsReadCount) ✅
```

---

## 🔍 디버깅 가이드

### 1. 연결 실패 시

**증상:** `connect_error`

**체크리스트:**
- [ ] NestJS 서버가 실행 중인가? (`npm run start:dev`)
- [ ] JWT 토큰이 유효한가?
- [ ] Gateway URL이 올바른가? (기본값: `http://localhost:3000`)
- [ ] VP 인증이 완료되었는가?

**해결 방법:**
```bash
# NestJS 로그 확인
npm run start:dev

# 토큰 재발급
curl -X POST http://localhost:3000/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0xYOUR_ADDRESS"}'
```

---

### 2. 채팅방 입장 실패 시

**증상:** `joinRoom` 응답 `{ success: false, error: "No permission" }`

**체크리스트:**
- [ ] 채팅방 ID가 존재하는가?
- [ ] 사용자가 채팅방 참여자인가? (`chat_participant` 테이블 확인)
- [ ] Spring의 `/api/chat/room/check-permission` API가 동작하는가?

**DB 확인:**
```sql
-- MySQL/PostgreSQL
SELECT * FROM chat_participant WHERE room_id = 1;
```

**Spring API 직접 호출:**
```bash
curl -X GET "http://localhost:8080/api/chat/room/check-permission?roomId=1&walletAddress=0xYOUR_ADDRESS"
```

---

### 3. 메시지 전송 실패 시

**증상:** `sendMessage` 응답 `{ success: false }`

**체크리스트:**
- [ ] Redis 서버가 실행 중인가?
- [ ] Spring이 Redis `"chat"` 채널을 구독 중인가?
- [ ] Member가 DB에 등록되어 있는가?
- [ ] ChatParticipant가 존재하는가?

**Redis 확인:**
```bash
# Redis CLI
redis-cli

# 모니터링 시작
MONITOR

# 다른 터미널에서 메시지 전송 테스트
```

**예상 Redis 로그:**
```
1. "PUBLISH" "chat" "{\"roomId\":1,\"chatSenderId\":\"0xABC...\",\"message\":\"Hello\"}"
   ↑ NestJS → Spring

2. "PUBLISH" "nestjs:broadcast:1" "{\"messageId\":120,\"senderId\":\"0xABC...\",\"message\":\"Hello\",...}"
   ↑ Spring → NestJS (브로드캐스트)
```

---

### 4. 브로드캐스트 수신 실패 시

**증상:** 메시지는 전송되지만 다른 사용자가 받지 못함

**체크리스트:**
- [ ] Spring의 `RedisPubSubService.onMessage()`가 정상 동작하는가?
- [ ] Spring이 `"nestjs:broadcast:{roomId}"` 채널로 재발행하는가?
- [ ] NestJS가 `"nestjs:broadcast:*"` 패턴을 구독 중인가?

**NestJS 로그 확인:**
```
[ChatGateway] Redis subscriber initialized for chat (nestjs:broadcast:* pattern)
[ChatGateway] Broadcasting message from Spring to room 1
```

**Spring 로그 확인:**
```java
// RedisPubSubService.java
logger.info("Publishing to NestJS: nestjs:broadcast:{}", roomId);
```

---

### 5. 메시지 히스토리 조회 실패 시

**증상:** `joinRoom` 응답의 `messages` 배열이 비어있음

**체크리스트:**
- [ ] Spring의 `/api/chat/{roomId}/enter` API가 동작하는가?
- [ ] DB에 `chat_message` 데이터가 있는가?
- [ ] `markAsReadCount()` 메서드가 정상 동작하는가?

**DB 확인:**
```sql
SELECT * FROM chat_message WHERE room_id = 1 ORDER BY created_at DESC;
```

**Spring API 직접 호출:**
```bash
curl -X POST "http://localhost:8080/api/chat/1/enter" \
  -H "X-Wallet-Address: 0xYOUR_ADDRESS"
```

---

## 📊 성공 시나리오

### 1. Redis 메시지 흐름

```
Client → NestJS                      [socket.emit('sendMessage')]
NestJS → Redis                       [PUBLISH "chat" {...}]
Redis → Spring                       [RedisPubSubService.onMessage()]
Spring → DB                          [ChatMessage 저장]
Spring → Redis                       [PUBLISH "nestjs:broadcast:1" {...}]
Redis → NestJS                       [ChatGateway.pmessage handler]
NestJS → Clients                     [socket.io broadcast]
```

### 2. 채팅방 입장 흐름

```
Client: socket.emit('joinRoom', {roomId: 1})
   ↓
NestJS: ChatGateway.handleJoinRoom()
   ├─ chatService.canJoinRoom() → Spring: /room/check-permission
   ├─ client.join('room:1') → Socket.io room
   └─ chatService.enterRoom() → Spring: /chat/1/enter
      ├─ getChatMessages() → 메시지 히스토리
      └─ markAsReadCount() → 읽음 처리
   ↓
Client: { success: true, messages: [...] }
```

### 3. DB 상태 확인

**입양 공고 작성 후:**
```sql
SELECT * FROM adopt WHERE adopt_id = 123;
-- adoptId: 123, memberId: 'User A', petId: 10
```

**채팅방 생성 후:**
```sql
SELECT * FROM chat_room WHERE room_id = 45;
-- roomId: 45, initiatorId: 'User B', targetId: 'User A', adoptId: 123

SELECT * FROM chat_participant WHERE room_id = 45;
-- User A: participantId: 1, memberId: 'User A', roomId: 45
-- User B: participantId: 2, memberId: 'User B', roomId: 45
```

**메시지 전송 후:**
```sql
SELECT * FROM chat_message WHERE room_id = 45 ORDER BY created_at;
-- messageId: 120, roomId: 45, senderId: 'User B', message: '안녕하세요...'
-- messageId: 121, roomId: 45, senderId: 'User A', message: '네! 주말에...'
```

---

## 🚀 다음 단계

### 1. 프론트엔드 통합

참고: `FRONTEND_CHAT_GUIDE.md`

### 2. Spring 개발자 작업

참고: `SPRING_INTEGRATION_GUIDE.md`

**필수 작업:**
- [ ] `ChatController.java`에 `/room/check-permission` API 추가
- [ ] `RedisPubSubService.java` 브로드캐스트 채널 수정 (`/topic/{roomId}` → `nestjs:broadcast:{roomId}`)
- [ ] STOMP 비활성화 (선택)

### 3. 추가 테스트

- [ ] 동시 접속자 100명 이상 테스트
- [ ] 메시지 전송 속도 테스트 (초당 메시지 수)
- [ ] Redis 장애 시나리오 테스트
- [ ] Spring 서버 재시작 시나리오 테스트
- [ ] 이미지 전송 기능 테스트
- [ ] 채팅방 나가기 기능 테스트

---

## 📚 참고 문서

- `CHAT_INTEGRATION_SUMMARY.md` - 완료된 작업 요약
- `CHAT_INTEGRATION_README.md` - 전체 통합 가이드
- `SPRING_INTEGRATION_GUIDE.md` - Spring 개발자용 상세 가이드
- `FRONTEND_CHAT_GUIDE.md` - 프론트엔드 개발자용 가이드
- `spring-chat-analysis.md` - Spring 코드 분석

---

**작성일:** 2025-10-21
**버전:** 1.0
**작성자:** Claude Code

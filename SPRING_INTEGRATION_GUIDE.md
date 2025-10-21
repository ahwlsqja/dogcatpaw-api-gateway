# Spring 채팅 서버 - NestJS 통합 가이드

## 📋 개요

NestJS API Gateway와 통합하기 위한 Spring 코드 수정 가이드입니다.

**통합 방식:**
- NestJS가 인증/인가 + Socket.io 실시간 통신 담당
- Spring이 비즈니스 로직 + DB 영속성 담당
- Redis Pub/Sub으로 메시지 전달
- **STOMP는 비활성화** (클라이언트는 Socket.io만 사용)

---

## 🗂️ 파일별 처리 방안

### ✅ 그대로 사용 (수정 불필요)

#### Entity
- `ChatRoom.java` ✅
- `ChatMessage.java` ✅
- `ChatParticipant.java` ✅
- `ChatReadStatus.java` ✅
- `RoomStatus.java` ✅

#### DTO
- `ChatReqDTO.java` ✅
- `ChatResDTO.java` ✅

#### Repository
- `ChatRoomRepository.java` ✅
- `ChatMessageRepository.java` ✅
- `ChatParticipantRepository.java` ✅
- `ChatReadStatusRepository.java` ✅

#### Service (Query)
- `ChatRoomQueryService.java` ✅
- `ChatMessageQueryService.java` ✅
- `ChatParticipantQueryService.java` ✅

#### Service (Command)
- `ChatRoomCommandService.java` ✅
- `ChatParticipantCommandService.java` ✅
- `ChatMessageCommandService.java` ✅

#### Config
- `RedisConfig.java` ✅

---

### 🔧 수정 필요

#### 1. `ChatController.java` - 권한 체크 API 추가

**위치:** 파일 끝에 추가

```java
/**
 * NestJS Gateway용 권한 체크 API
 * 채팅방 참여 권한 확인
 */
@Operation(summary = "채팅방 참여 권한 확인", description = "NestJS Gateway에서 사용하는 권한 체크 API")
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

**변경 이유:**
- NestJS가 채팅방 입장 시 권한 검증용으로 호출
- `chatParticipantQueryService.isRoomParticipant()` 메서드 재활용

---

#### 2. `RedisPubSubService.java` - 브로드캐스트 채널 변경

**기존 코드 (Line 43-45):**
```java
// 직렬화하여 json으로 stomp에 publish (이때 경로는 반드시 /topic)
String stompMessage = objectMapper.writeValueAsString(messageReqDTO);
redisTemplate.convertAndSend("/topic/" + messageReqDTO.getRoomId(), stompMessage);
```

**수정 후:**
```java
// NestJS Gateway로 브로드캐스트
String jsonMessage = objectMapper.writeValueAsString(messageReqDTO);

// 기존 STOMP 발행 제거 (STOMP 비활성화됨)
// redisTemplate.convertAndSend("/topic/" + messageReqDTO.getRoomId(), stompMessage);

// ⭐ NestJS용 Redis 채널로 발행
redisTemplate.convertAndSend("nestjs:broadcast:" + messageReqDTO.getRoomId(), jsonMessage);

log.info("메시지 브로드캐스트 완료 - 채널: nestjs:broadcast:{}", messageReqDTO.getRoomId());
```

**변경 이유:**
- STOMP 클라이언트가 없으므로 `/topic/{roomId}` 발행 불필요
- NestJS가 `nestjs:broadcast:{roomId}` 채널을 구독하여 Socket.io로 전달

---

### ❌ 비활성화 (사용 안 함)

#### STOMP 관련 파일들

**다음 파일들은 비활성화하거나 삭제:**

1. **`StompWebSockConfig.java`**
   - **비활성화 방법:** `@Configuration` 주석 처리
   ```java
   // @Configuration  ← 주석 처리
   // @EnableWebSocketMessageBroker  ← 주석 처리
   @RequiredArgsConstructor
   public class StompWebSockConfig implements WebSocketMessageBrokerConfigurer {
       // ...
   }
   ```
   - **이유:** STOMP WebSocket 서버 비활성화

2. **`StompController.java`**
   - **비활성화 방법:** `@Controller` 주석 처리
   ```java
   // @Controller  ← 주석 처리
   @RequiredArgsConstructor
   public class StompController {
       // ...
   }
   ```
   - **이유:** STOMP 메시지 핸들러 불필요

3. **`StompHandler.java`**
   - **처리:** 그대로 두거나 주석 처리
   - **이유:** STOMP Interceptor 불필요 (설정 비활성화되면 자동 무시됨)

4. **`StompEventListener.java`**
   - **처리:** 그대로 두거나 주석 처리
   - **이유:** STOMP 이벤트 리스너 불필요

5. **`ChatEntryService.java`**
   - **처리:** 그대로 두거나 주석 처리
   - **이유:** STOMP 권한 검증 불필요 (NestJS에서 처리)

**비활성화 확인:**
```bash
# Spring 애플리케이션 로그에서 다음 메시지가 나오지 않으면 성공
# "Mapped "{[/ws]}" onto ...
# "WebSocket STOMP endpoint registered"
```

---

## 🔄 전체 메시지 흐름

### 메시지 전송 플로우

```
1. 클라이언트 (Socket.io)
   ↓
2. NestJS Gateway
   - 인증/인가 검증
   - Redis "chat" 채널에 publish
   ↓
3. Redis Pub/Sub
   ↓
4. Spring RedisPubSubService.onMessage()
   ├─ ChatMessageReqDTO 역직렬화
   ├─ DB 저장 (ChatMessage, ChatReadStatus)
   └─ Redis "nestjs:broadcast:{roomId}" 재발행  ← ⭐ 수정 부분
   ↓
5. Redis Pub/Sub
   ↓
6. NestJS Redis Subscriber
   ↓
7. Socket.io emit → 방의 모든 클라이언트
```

### 채팅방 입장 플로우

```
1. 클라이언트 (Socket.io)
   ↓
2. NestJS Gateway
   ├─ Spring REST API 호출: /api/chat/room/check-permission  ← ⭐ 신규 API
   ├─ Spring: chatParticipantQueryService.isRoomParticipant() 검증
   └─ 권한 있으면 Socket.io room 입장
```

---

## 📝 수정 체크리스트

### 필수 수정 (2개)

- [ ] `ChatController.java`에 `checkPermission()` API 추가
- [ ] `RedisPubSubService.java`의 `onMessage()` 메서드 수정
  - `/topic/{roomId}` 발행 제거
  - `nestjs:broadcast:{roomId}` 발행 추가

### STOMP 비활성화 (4개)

- [ ] `StompWebSockConfig.java` - `@Configuration` 주석 처리
- [ ] `StompController.java` - `@Controller` 주석 처리
- [ ] `StompHandler.java` - (선택) 주석 처리
- [ ] `StompEventListener.java` - (선택) 주석 처리

### 확인 사항

- [ ] Spring 애플리케이션 정상 기동
- [ ] STOMP WebSocket 엔드포인트 비활성화 확인 (로그)
- [ ] `/api/chat/room/check-permission` API 테스트
  ```bash
  curl "http://localhost:8080/api/chat/room/check-permission?roomId=1&walletAddress=0x123..."
  # 응답: {"canJoin": true/false}
  ```
- [ ] Redis "chat" 채널 구독 확인 (RedisConfig.java Line 74)
- [ ] DB에 ChatMessage 정상 저장 확인

---

## 🧪 테스트 방법

### 1. Redis Pub/Sub 테스트

**Redis CLI로 메시지 발행 테스트:**
```bash
# Redis CLI 접속
redis-cli

# "chat" 채널에 메시지 발행
PUBLISH chat '{"roomId":1,"chatSenderId":"0x1234567890abcdef","message":"Test message"}'

# 다른 터미널에서 브로드캐스트 채널 구독
SUBSCRIBE nestjs:broadcast:1

# 메시지가 nestjs:broadcast:1로 재발행되는지 확인
```

**예상 결과:**
```
1. Spring 로그:
   - "Redis 메시지 수신 - 채널: chat, 메시지: ..."
   - "메시지 역직렬화 성공 - 방: 1, 발신자: 0x123..., 내용: Test message"
   - "메시지 브로드캐스트 완료 - 채널: nestjs:broadcast:1"

2. DB 확인:
   - chat_message 테이블에 새 레코드 INSERT
   - chat_read_status 테이블에 참여자 수만큼 레코드 INSERT

3. Redis 구독 터미널:
   - nestjs:broadcast:1 채널에서 메시지 수신
```

---

### 2. REST API 테스트

```bash
# 1. 채팅방 생성
curl -X POST http://localhost:8080/api/chat/room/create \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Address: 0x1234567890abcdef" \
  -d '{
    "adoptWriterId": "0xabcdef1234567890",
    "adoptId": 1,
    "roomName": "테스트 채팅방"
  }'

# 응답: {"roomId": 1, "roomName": "테스트 채팅방"}

# 2. 권한 체크 (신규 API)
curl "http://localhost:8080/api/chat/room/check-permission?roomId=1&walletAddress=0x1234567890abcdef"

# 응답: {"canJoin": true}

# 3. 채팅방 입장 (메시지 조회 + 읽음 처리)
curl -X POST http://localhost:8080/api/chat/1/enter \
  -H "X-Wallet-Address: 0x1234567890abcdef"

# 응답: [메시지 목록]
```

---

## ⚠️ 주의사항

### 1. Member 엔티티 의존성

Spring은 `chatSenderId` (지갑 주소)로 `Member`를 조회합니다.

**확인 필요:**
```java
// ChatMessageCommandService.java:44-45
ChatParticipant sender = chatParticipantQueryService
    .findByMemberIdAndChatRoomId(chatMessageReqDTO.getChatSenderId(), chatRoom.getId());
```

**요구사항:**
- 메시지를 보내는 지갑 주소가 `member` 테이블에 이미 존재해야 함
- 없으면 `MEMBER_NOTFOUND` 에러 발생

**해결 방안:**
- NestJS 회원가입 API가 Spring `member` 테이블에 지갑 주소 저장하는지 확인
- 또는 채팅 전 자동 Member 생성 로직 추가

---

### 2. ChatParticipant 생성

채팅방에 메시지를 보내려면 해당 지갑 주소가 `chat_participant` 테이블에 있어야 합니다.

**확인 쿼리:**
```sql
SELECT * FROM chat_participant
WHERE member_id = '0x1234567890abcdef'
  AND room_id = 1;
```

**없으면 에러:**
```
PARTICIPANT_NOTFOUND
```

**해결 방안:**
- 채팅방 생성 시 자동으로 두 참여자(initiator, target) 추가
- 또는 채팅방 입장 API에서 자동 추가

---

### 3. Redis 연결 설정

**application.yml 확인:**
```yaml
spring:
  data:
    redis:
      host: localhost  # NestJS와 동일한 Redis 사용
      port: 6379
      password: your-password  # 있다면
```

**NestJS와 동일한 Redis 인스턴스 사용 필수!**

---

## 📊 수정 전/후 비교

### Redis Pub/Sub 흐름

**수정 전:**
```
NestJS → Redis "chat:room:{roomId}"  ❌ 잘못된 채널
Spring → Redis "/topic/{roomId}"     ❌ STOMP 전용
```

**수정 후:**
```
NestJS → Redis "chat"                           ✅ Spring이 구독 중
Spring → Redis "nestjs:broadcast:{roomId}"      ✅ NestJS가 구독
```

---

### API 엔드포인트

**기존:**
```
POST /api/chat/room/create
POST /api/chat/{roomId}/enter
GET  /api/chat/room/card
GET  /api/chat/room/list
GET  /api/chat/room/{roomId}/adoption
```

**추가:**
```
GET  /api/chat/room/check-permission  ← ⭐ 신규
```

---

## 🚀 배포 후 확인

### 1. Spring 애플리케이션 로그

```
✅ 정상:
- Redis 연결 성공
- RedisMessageListenerContainer started
- "chat" 채널 구독 시작

❌ 비정상:
- WebSocket STOMP endpoint registered  ← STOMP가 활성화되면 안 됨!
```

### 2. Redis 모니터링

```bash
redis-cli MONITOR

# 예상 로그:
# "PUBLISH" "chat" "{\"roomId\":1,...}"
# "PUBLISH" "nestjs:broadcast:1" "{...}"
```

### 3. DB 데이터 확인

```sql
-- 메시지 저장 확인
SELECT * FROM chat_message ORDER BY created_at DESC LIMIT 10;

-- 읽음 상태 확인
SELECT * FROM chat_read_status WHERE message_id = [최신 메시지 ID];
```

---

## 📞 통합 테스트 시나리오

### 시나리오 1: 메시지 전송

1. NestJS에서 Redis "chat" 채널에 메시지 발행
2. Spring이 수신하여 DB 저장
3. Spring이 Redis "nestjs:broadcast:{roomId}" 재발행
4. NestJS가 수신하여 Socket.io로 클라이언트에게 전달

**확인 포인트:**
- [ ] DB에 메시지 저장됨
- [ ] 읽음 상태 생성됨 (보낸 사람 isRead=true, 다른 사람 false)
- [ ] Redis "nestjs:broadcast:{roomId}"로 재발행됨

---

### 시나리오 2: 채팅방 권한 체크

1. NestJS에서 `/api/chat/room/check-permission` API 호출
2. Spring이 `chat_participant` 테이블 조회
3. 권한 여부 반환

**확인 포인트:**
- [ ] 참여자면 `canJoin: true`
- [ ] 비참여자면 `canJoin: false`

---

## 📦 최종 파일 목록

### 수정 필요 (2개)
- `ChatController.java` - API 1개 추가
- `RedisPubSubService.java` - 브로드캐스트 채널 변경

### 비활성화 (4-5개)
- `StompWebSockConfig.java` - @Configuration 주석
- `StompController.java` - @Controller 주석
- `StompHandler.java` - (선택) 주석
- `StompEventListener.java` - (선택) 주석
- `ChatEntryService.java` - (선택) 주석

### 그대로 사용 (나머지 전부)
- Entity (5개)
- DTO (2개)
- Repository (4개)
- Service (6개)
- RedisConfig (1개)

---

## 🎯 다음 단계

1. ✅ Spring 코드 수정 완료
2. NestJS Gateway 수정 (별도 가이드 참조)
3. 통합 테스트
4. 프론트엔드 연동

---

## 💬 문의사항

수정 중 문제가 발생하거나 궁금한 점이 있으면:
- NestJS 개발팀과 협의
- Redis 채널명 변경 필요 시 양측 조율
- 테스트 결과 공유

---

**작성일:** 2025-10-21
**버전:** 1.0
**담당:** NestJS Gateway Team

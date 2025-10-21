# 프론트엔드 채팅 통합 가이드

## 📋 개요

NestJS API Gateway와 Socket.io를 사용한 실시간 채팅 구현 가이드입니다.

**기술 스택:**
- **프로토콜:** Socket.io (WebSocket)
- **인증:** JWT (Bearer Token)
- **엔드포인트:** `ws://gateway-url:3000/chat`

---

## 🚀 빠른 시작

### 1. 라이브러리 설치

```bash
npm install socket.io-client
# 또는
yarn add socket.io-client
```

### 2. 기본 연결 예제

```typescript
import { io, Socket } from 'socket.io-client';

// Socket.io 연결
const socket: Socket = io('ws://localhost:3000/chat', {
  auth: {
    token: localStorage.getItem('jwt_token') // JWT 토큰
  },
  transports: ['websocket'], // WebSocket만 사용
});

// 연결 성공
socket.on('connect', () => {
  console.log('Connected to chat server!', socket.id);
});

// 연결 실패
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

---

## 🔐 인증

### JWT 토큰 전달

**방법 1: auth 옵션 (추천)**
```typescript
const socket = io('ws://localhost:3000/chat', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
```

**방법 2: 연결 후 업데이트**
```typescript
socket.auth = { token: newToken };
socket.connect();
```

### 인증 실패 처리

```typescript
socket.on('connect_error', (error) => {
  if (error.message === 'Authentication token missing') {
    // 토큰 없음 → 로그인 페이지로 리다이렉트
    router.push('/login');
  } else if (error.message === 'Token has been revoked') {
    // 토큰 만료 또는 차단 → 재로그인
    alert('Session expired. Please login again.');
  }
});
```

---

## 📡 API 레퍼런스

### 이벤트 송신 (emit)

#### 1. 채팅방 입장 (joinRoom)

```typescript
socket.emit('joinRoom', { roomId: 1 }, (response) => {
  if (response.success) {
    console.log('방 입장 성공:', response.message);
  } else {
    console.error('방 입장 실패:', response.error);
    // 권한 없음 또는 존재하지 않는 방
  }
});
```

**요청:**
```typescript
{
  roomId: number; // 채팅방 ID
}
```

**응답:**
```typescript
{
  success: boolean;
  message?: string;  // 성공 시
  error?: string;    // 실패 시
}
```

---

#### 2. 메시지 전송 (sendMessage)

```typescript
socket.emit('sendMessage', {
  roomId: 1,
  message: 'Hello, world!'
}, (response) => {
  if (response.success) {
    console.log('메시지 전송 완료:', response.data);
  } else {
    console.error('메시지 전송 실패:', response.error);
  }
});
```

**요청:**
```typescript
{
  roomId: number;   // 채팅방 ID
  message: string;  // 메시지 내용
}
```

**응답:**
```typescript
{
  success: boolean;
  message?: string;  // 'Message sent'
  data?: {
    roomId: number;
    chatSenderId: string;  // 지갑 주소
    message: string;
    timestamp: Date;
  };
  error?: string;
}
```

---

#### 3. 채팅방 퇴장 (leaveRoom)

```typescript
socket.emit('leaveRoom', { roomId: 1 }, (response) => {
  if (response.success) {
    console.log('방 퇴장 성공');
  }
});
```

**요청:**
```typescript
{
  roomId: number;
}
```

**응답:**
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
}
```

---

### 이벤트 수신 (on)

#### 1. 메시지 수신 (message)

```typescript
socket.on('message', (data) => {
  console.log('새 메시지:', data);

  // UI 업데이트
  addMessageToUI({
    messageId: data.messageId,
    senderId: data.senderId,
    senderName: data.senderName,
    message: data.message,
    isRead: data.isRead,
    createdAt: data.createdAt,
  });
});
```

**데이터 형식:**
```typescript
{
  messageId: number;
  senderId: string;     // 지갑 주소
  senderName: string;   // 사용자 닉네임
  message: string;
  isRead: boolean;
  createdAt: string;    // ISO 8601 형식
  adoptId?: number;     // 관련 입양 공고 ID
}
```

---

#### 2. 연결 이벤트

```typescript
// 연결 성공
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

// 연결 끊김
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // 서버에서 강제 연결 끊음 (인증 실패 등)
    socket.connect(); // 재연결 시도
  }
});

// 재연결 시도
socket.on('reconnect_attempt', (attempt) => {
  console.log(`Reconnecting... (${attempt})`);
});

// 재연결 성공
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // 재입장 처리
  rejoinAllRooms();
});
```

---

## 💻 React/Next.js 통합

### React Hook 예제

```typescript
// hooks/useChat.ts
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  messageId: number;
  senderId: string;
  senderName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const useChat = (roomId: number) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Socket.io 연결
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      console.error('No JWT token found');
      return;
    }

    const socket = io('ws://localhost:3000/chat', {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    // 연결 이벤트
    socket.on('connect', () => {
      console.log('Chat connected');
      setIsConnected(true);

      // 방 입장
      socket.emit('joinRoom', { roomId }, (response) => {
        if (response.success) {
          setIsInRoom(true);
        } else {
          console.error('Failed to join room:', response.error);
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsInRoom(false);
    });

    // 메시지 수신
    socket.on('message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // 정리
    return () => {
      socket.emit('leaveRoom', { roomId });
      socket.disconnect();
    };
  }, [roomId]);

  // 메시지 전송
  const sendMessage = (text: string) => {
    if (!socketRef.current || !isInRoom) {
      console.error('Not connected or not in room');
      return;
    }

    socketRef.current.emit('sendMessage', {
      roomId,
      message: text,
    }, (response) => {
      if (!response.success) {
        console.error('Failed to send message:', response.error);
      }
    });
  };

  return {
    messages,
    isConnected,
    isInRoom,
    sendMessage,
  };
};
```

### 컴포넌트 사용 예제

```typescript
// components/ChatRoom.tsx
import React, { useState } from 'react';
import { useChat } from '../hooks/useChat';

interface ChatRoomProps {
  roomId: number;
  currentUserId: string; // 현재 사용자 지갑 주소
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId, currentUserId }) => {
  const { messages, isConnected, isInRoom, sendMessage } = useChat(roomId);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="chat-room">
      {/* 연결 상태 */}
      <div className="status">
        {isConnected ? (
          isInRoom ? '✅ 채팅방 입장' : '⏳ 입장 중...'
        ) : (
          '❌ 연결 끊김'
        )}
      </div>

      {/* 메시지 목록 */}
      <div className="messages">
        {messages.map((msg) => (
          <div
            key={msg.messageId}
            className={msg.senderId === currentUserId ? 'my-message' : 'other-message'}
          >
            <div className="sender">{msg.senderName}</div>
            <div className="content">{msg.message}</div>
            <div className="time">
              {new Date(msg.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      {/* 입력창 */}
      <div className="input-area">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="메시지를 입력하세요..."
          disabled={!isInRoom}
        />
        <button onClick={handleSend} disabled={!isInRoom}>
          전송
        </button>
      </div>
    </div>
  );
};
```

---

## 🧪 테스트 예제

### 브라우저 콘솔 테스트

```javascript
// 개발자 도구 콘솔에서 실행

// 1. 연결
const socket = io('ws://localhost:3000/chat', {
  auth: { token: 'your-jwt-token' }
});

// 2. 연결 확인
socket.on('connect', () => console.log('Connected!'));

// 3. 방 입장
socket.emit('joinRoom', { roomId: 1 }, (res) => console.log(res));

// 4. 메시지 수신 리스너
socket.on('message', (msg) => console.log('New message:', msg));

// 5. 메시지 전송
socket.emit('sendMessage', { roomId: 1, message: 'Test!' }, (res) => console.log(res));

// 6. 방 퇴장
socket.emit('leaveRoom', { roomId: 1 }, (res) => console.log(res));

// 7. 연결 종료
socket.disconnect();
```

---

## ⚠️ 주의사항 및 Best Practices

### 1. 재연결 처리

```typescript
socket.on('reconnect', () => {
  // 재연결 시 모든 방에 다시 입장
  const joinedRooms = getJoinedRooms(); // 상태에서 가져오기
  joinedRooms.forEach(roomId => {
    socket.emit('joinRoom', { roomId });
  });
});
```

### 2. 메모리 누수 방지

```typescript
useEffect(() => {
  const socket = io(/*...*/);

  return () => {
    // 컴포넌트 언마운트 시 반드시 정리
    socket.off('message');
    socket.off('connect');
    socket.off('disconnect');
    socket.disconnect();
  };
}, []);
```

### 3. 에러 처리

```typescript
socket.emit('sendMessage', { roomId: 1, message: 'Hi' }, (response) => {
  if (!response.success) {
    // 사용자에게 에러 메시지 표시
    toast.error(`메시지 전송 실패: ${response.error}`);

    if (response.error === 'Unauthorized') {
      // 재로그인 유도
      router.push('/login');
    } else if (response.error === 'No permission to join this room') {
      // 권한 없음
      alert('이 채팅방에 접근할 수 없습니다.');
    }
  }
});
```

### 4. 읽음 처리

```typescript
// 채팅방 입장 시 Spring REST API로 메시지 읽음 처리
useEffect(() => {
  if (isInRoom) {
    fetch(`http://localhost:3000/api/chat/${roomId}/enter`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(messages => {
        // 기존 메시지 목록 표시
        setMessages(messages);
      });
  }
}, [isInRoom, roomId]);
```

---

## 🔧 환경 설정

### 개발 환경
```typescript
const CHAT_SERVER_URL = process.env.NODE_ENV === 'production'
  ? 'wss://api.yourservice.com/chat'
  : 'ws://localhost:3000/chat';

const socket = io(CHAT_SERVER_URL, {
  auth: { token: getToken() }
});
```

### CORS 이슈 대응
프로덕션 환경에서는 Gateway 설정에서 허용된 origin인지 확인하세요.

---

## 📊 메시지 흐름

```
1. 사용자 A가 메시지 입력 → Send 버튼 클릭
   ↓
2. socket.emit('sendMessage', { roomId, message })
   ↓
3. NestJS Gateway 수신 → 인증 확인 → Spring으로 전달 (Redis)
   ↓
4. Spring이 DB 저장 → Redis로 브로드캐스트
   ↓
5. NestJS가 Redis 구독 → Socket.io로 방 전체에 emit
   ↓
6. 사용자 A, B, C 모두 'message' 이벤트로 수신
   ↓
7. UI 업데이트
```

---

## 🐛 디버깅

### Socket.io 디버그 모드

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000/chat', {
  auth: { token: 'your-token' },
  // 디버그 모드 활성화
  transports: ['websocket'],
  upgrade: false,
});

// 모든 이벤트 로깅
socket.onAny((event, ...args) => {
  console.log(`[${event}]`, args);
});

// 아웃고잉 이벤트 로깅
socket.onAnyOutgoing((event, ...args) => {
  console.log(`[SEND ${event}]`, args);
});
```

### 네트워크 확인

```bash
# 브라우저 DevTools → Network 탭 → WS (WebSocket) 필터
# 또는 Chrome: chrome://net-internals/#sockets
```

---

## 📞 REST API 통합

채팅방 목록, 메시지 히스토리 등은 REST API로 조회:

```typescript
// 채팅방 목록 조회
const response = await fetch('http://localhost:3000/api/chat/room/list', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
const rooms = await response.json();

// 채팅방 입장 (메시지 히스토리 조회 + 읽음 처리)
const messagesRes = await fetch(`http://localhost:3000/api/chat/${roomId}/enter`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
const messageHistory = await messagesRes.json();
```

---

## 🎯 체크리스트

프론트엔드 개발 전 확인:

- [ ] JWT 토큰 발급 완료 (VP 인증)
- [ ] Spring 서버에 Member (지갑 주소) 등록 완료
- [ ] 채팅방 생성 API로 채팅방 생성 완료
- [ ] Gateway WebSocket 엔드포인트 확인 (ws://gateway-url:3000/chat)
- [ ] CORS 설정 확인
- [ ] Socket.io 클라이언트 라이브러리 설치

---

## 📦 TypeScript 타입 정의

```typescript
// types/chat.ts
export interface JoinRoomDto {
  roomId: number;
}

export interface SendMessageDto {
  roomId: number;
  message: string;
}

export interface ChatMessage {
  messageId: number;
  senderId: string;     // 지갑 주소
  senderName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  adoptId?: number;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

// Socket.io 이벤트 타입
export interface ServerToClientEvents {
  message: (data: ChatMessage) => void;
}

export interface ClientToServerEvents {
  joinRoom: (dto: JoinRoomDto, callback: (response: ChatResponse) => void) => void;
  leaveRoom: (dto: JoinRoomDto, callback: (response: ChatResponse) => void) => void;
  sendMessage: (dto: SendMessageDto, callback: (response: ChatResponse) => void) => void;
}
```

---

**작성일:** 2025-10-21
**버전:** 1.0
**문의:** NestJS Gateway Team

# 💬 프론트엔드 WebSocket 채팅 통합 가이드

## 📋 개요

API Gateway에서 **Socket.io + VP 인증** 기반 실시간 채팅을 제공합니다.
이 가이드는 React/Vue/Next.js 등 프론트엔드에서 채팅을 구현하는 방법을 설명합니다.

---

## 🚀 빠른 시작

### 1. Socket.io 클라이언트 설치

```bash
npm install socket.io-client
# or
yarn add socket.io-client
# or
pnpm add socket.io-client
```

### 2. 기본 연결 코드

```typescript
import { io, Socket } from 'socket.io-client';

// Access Token 가져오기 (로그인 후)
const accessToken = localStorage.getItem('accessToken');

// WebSocket 연결
const socket: Socket = io('http://localhost:3000/chat', {
  auth: {
    token: accessToken
  }
});

// 연결 성공
socket.on('connect', () => {
  console.log('✅ Connected to chat server');
});

// 연결 실패
socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
});
```

---

## 🔐 인증 흐름

### Access Token 발급 (로그인)

먼저 `/api/auth/login` API로 로그인하여 Access Token을 받아야 합니다.

```typescript
// 1. Challenge 요청
const challengeResponse = await fetch('http://localhost:3000/api/auth/challenge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress: '0xYourAddress' })
});
const { challenge } = await challengeResponse.json();

// 2. 지갑으로 서명
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [challenge, walletAddress]
});

// 3. 로그인 (Access Token + VP 자동 생성)
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress,
    challenge,
    signature
  })
});

const { accessToken, vpJwt } = await loginResponse.json();

// 4. Access Token 저장
localStorage.setItem('accessToken', accessToken);
```

---

## 💬 채팅 기능 구현

### React 예시

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  messageId: number;
  roomId: number;
  senderId: string;
  senderName: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export function ChatRoom({ roomId }: { roomId: number }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    // Socket.io 연결
    const accessToken = localStorage.getItem('accessToken');
    const newSocket = io('http://localhost:3000/chat', {
      auth: { token: accessToken }
    });

    newSocket.on('connect', () => {
      console.log('Connected!');

      // 방 입장
      newSocket.emit('joinRoom', { roomId }, (response: any) => {
        console.log('Join response:', response);
      });
    });

    // 메시지 수신
    newSocket.on('message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.emit('leaveRoom', { roomId });
      newSocket.disconnect();
    };
  }, [roomId]);

  // 메시지 전송
  const sendMessage = () => {
    if (!socket || !inputMessage.trim()) return;

    socket.emit('sendMessage', {
      roomId,
      message: inputMessage
    }, (response: any) => {
      if (response.success) {
        setInputMessage('');
      }
    });
  };

  return (
    <div className="chat-room">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.messageId} className="message">
            <strong>{msg.senderName}:</strong> {msg.message}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="메시지를 입력하세요..."
        />
        <button onClick={sendMessage}>전송</button>
      </div>
    </div>
  );
}
```

---

### Vue 3 (Composition API) 예시

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  messageId: number;
  roomId: number;
  senderId: string;
  senderName: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const props = defineProps<{ roomId: number }>();

const socket = ref<Socket | null>(null);
const messages = ref<ChatMessage[]>([]);
const inputMessage = ref('');

onMounted(() => {
  const accessToken = localStorage.getItem('accessToken');

  socket.value = io('http://localhost:3000/chat', {
    auth: { token: accessToken }
  });

  socket.value.on('connect', () => {
    console.log('Connected!');

    socket.value?.emit('joinRoom', { roomId: props.roomId }, (response: any) => {
      console.log('Join response:', response);
    });
  });

  socket.value.on('message', (message: ChatMessage) => {
    messages.value.push(message);
  });
});

onUnmounted(() => {
  socket.value?.emit('leaveRoom', { roomId: props.roomId });
  socket.value?.disconnect();
});

const sendMessage = () => {
  if (!socket.value || !inputMessage.value.trim()) return;

  socket.value.emit('sendMessage', {
    roomId: props.roomId,
    message: inputMessage.value
  }, (response: any) => {
    if (response.success) {
      inputMessage.value = '';
    }
  });
};
</script>

<template>
  <div class="chat-room">
    <div class="messages">
      <div v-for="msg in messages" :key="msg.messageId" class="message">
        <strong>{{ msg.senderName }}:</strong> {{ msg.message }}
      </div>
    </div>

    <div class="input-area">
      <input
        v-model="inputMessage"
        @keyup.enter="sendMessage"
        placeholder="메시지를 입력하세요..."
      />
      <button @click="sendMessage">전송</button>
    </div>
  </div>
</template>
```

---

## 📡 WebSocket 이벤트

### Client → Server (Emit)

#### 1. `joinRoom` - 방 입장
```typescript
socket.emit('joinRoom', { roomId: 123 }, (response) => {
  // response: { success: true, message: "Joined room 123" }
});
```

#### 2. `sendMessage` - 메시지 전송
```typescript
socket.emit('sendMessage', {
  roomId: 123,
  message: '안녕하세요!'
}, (response) => {
  // response: { success: true, message: "Message sent", data: {...} }
});
```

#### 3. `leaveRoom` - 방 퇴장
```typescript
socket.emit('leaveRoom', { roomId: 123 }, (response) => {
  // response: { success: true, message: "Left room 123" }
});
```

---

### Server → Client (On)

#### 1. `connect` - 연결 성공
```typescript
socket.on('connect', () => {
  console.log('Connected!');
});
```

#### 2. `message` - 새 메시지 수신
```typescript
socket.on('message', (data: ChatMessage) => {
  console.log('New message:', data);
  // {
  //   messageId: 456,
  //   roomId: 123,
  //   senderId: "0xAbC123...",
  //   senderName: "홍길동",
  //   message: "안녕하세요!",
  //   isRead: false,
  //   createdAt: "2025-10-17T12:34:56Z"
  // }
});
```

#### 3. `connect_error` - 연결 실패
```typescript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  // "Authentication token missing"
  // "Token has been revoked"
  // "Invalid token"
});
```

---

## 🛠️ 고급 기능

### 1. 메시지 읽음 표시

```typescript
// 서버에 읽음 상태 업데이트 (REST API)
const markAsRead = async (messageId: number) => {
  await fetch(`http://localhost:3000/api/chat/message/${messageId}/read`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
};

// 메시지 수신 시 자동으로 읽음 처리
socket.on('message', (message: ChatMessage) => {
  setMessages(prev => [...prev, message]);

  // 내가 보낸 메시지가 아니면 읽음 처리
  if (message.senderId !== myWalletAddress) {
    markAsRead(message.messageId);
  }
});
```

---

### 2. 타이핑 인디케이터

```typescript
// 타이핑 중 이벤트 전송
const handleTyping = () => {
  socket.emit('typing', { roomId, userId: myWalletAddress });
};

// 타이핑 중 상태 수신
socket.on('userTyping', (data: { userId: string, roomId: number }) => {
  setTypingUsers(prev => [...prev, data.userId]);

  // 3초 후 제거
  setTimeout(() => {
    setTypingUsers(prev => prev.filter(id => id !== data.userId));
  }, 3000);
});
```

---

### 3. 재연결 처리

```typescript
const socket = io('http://localhost:3000/chat', {
  auth: { token: accessToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected after ${attemptNumber} attempts`);

  // 재연결 시 다시 방 입장
  socket.emit('joinRoom', { roomId });
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect');
  alert('연결이 끊어졌습니다. 페이지를 새로고침하세요.');
});
```

---

### 4. 오프라인 메시지 로드

```typescript
useEffect(() => {
  // WebSocket 연결 전, REST API로 이전 메시지 로드
  const loadPreviousMessages = async () => {
    const response = await fetch(
      `http://localhost:3000/api/chat/${roomId}/enter`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    setMessages(data); // 이전 메시지 설정
  };

  loadPreviousMessages();

  // 그 후 WebSocket 연결
  const newSocket = io('http://localhost:3000/chat', {
    auth: { token: accessToken }
  });

  // ...
}, [roomId]);
```

---

## 🔒 보안 고려사항

### 1. Access Token 관리
```typescript
// ✅ Good: 자동 토큰 갱신
const refreshToken = async () => {
  const response = await fetch('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('refreshToken')}`
    }
  });

  const { accessToken } = await response.json();
  localStorage.setItem('accessToken', accessToken);

  // Socket 재연결
  socket.disconnect();
  socket.auth = { token: accessToken };
  socket.connect();
};

// Token 만료 시 자동 갱신
socket.on('connect_error', async (error) => {
  if (error.message === 'Invalid token') {
    await refreshToken();
  }
});
```

### 2. XSS 방지
```typescript
// ❌ Bad: innerHTML 사용
messageElement.innerHTML = message.message;

// ✅ Good: textContent 사용
messageElement.textContent = message.message;

// ✅ Good: React는 자동으로 escape
<div>{message.message}</div>
```

---

## 🧪 테스트 도구

### WebSocket 테스트 페이지

```html
<!DOCTYPE html>
<html>
<head>
    <title>Chat Test</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <style>
        #messages { height: 300px; overflow-y: scroll; border: 1px solid #ccc; padding: 10px; }
        .message { margin: 5px 0; }
    </style>
</head>
<body>
    <h1>WebSocket Chat Test</h1>

    <div>
        <input id="token" type="text" placeholder="Access Token" style="width: 400px">
        <button onclick="connect()">Connect</button>
    </div>

    <div>
        <input id="roomId" type="number" placeholder="Room ID" value="1">
        <button onclick="joinRoom()">Join Room</button>
    </div>

    <div id="messages"></div>

    <div>
        <input id="messageInput" type="text" placeholder="Message" style="width: 300px">
        <button onclick="sendMessage()">Send</button>
    </div>

    <script>
        let socket = null;

        function connect() {
            const token = document.getElementById('token').value;
            socket = io('http://localhost:3000/chat', {
                auth: { token }
            });

            socket.on('connect', () => {
                addMessage('✅ Connected');
            });

            socket.on('message', (data) => {
                addMessage(`📩 ${data.senderName}: ${data.message}`);
            });

            socket.on('connect_error', (error) => {
                addMessage(`❌ Error: ${error.message}`);
            });
        }

        function joinRoom() {
            const roomId = parseInt(document.getElementById('roomId').value);
            socket.emit('joinRoom', { roomId }, (response) => {
                addMessage(`📍 ${JSON.stringify(response)}`);
            });
        }

        function sendMessage() {
            const roomId = parseInt(document.getElementById('roomId').value);
            const message = document.getElementById('messageInput').value;

            socket.emit('sendMessage', { roomId, message }, (response) => {
                addMessage(`✉️ Sent: ${JSON.stringify(response)}`);
                document.getElementById('messageInput').value = '';
            });
        }

        function addMessage(text) {
            const div = document.createElement('div');
            div.className = 'message';
            div.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
            document.getElementById('messages').appendChild(div);
        }
    </script>
</body>
</html>
```

---

## ❓ FAQ

### Q1: WebSocket 연결이 안 됩니다
**A:** Access Token이 유효한지 확인하세요. 로그인 후 발급받은 토큰을 사용해야 합니다.

### Q2: 메시지가 수신되지 않습니다
**A:** `joinRoom`을 먼저 호출했는지 확인하세요. 방에 입장해야 메시지를 받을 수 있습니다.

### Q3: CORS 에러가 발생합니다
**A:** API Gateway에서 CORS가 활성화되어 있습니다. 프로덕션 환경에서는 도메인을 제한할 수 있습니다.

### Q4: 토큰이 만료되면 어떻게 하나요?
**A:** `connect_error` 이벤트를 감지하고, Refresh Token으로 새 Access Token을 발급받으세요.

---

## 📚 참고 자료

- [Socket.io Client API](https://socket.io/docs/v4/client-api/)
- [VP 인증 개념](../docs/vp-authentication.md)
- [Spring 서버 가이드](./spring-websocket-guide.md)

---

## 💡 베스트 프랙티스

1. ✅ **항상 토큰 갱신 처리 구현**
2. ✅ **재연결 로직 추가**
3. ✅ **오프라인 메시지 로드**
4. ✅ **XSS 방지 (textContent 사용)**
5. ✅ **에러 핸들링 철저히**
6. ✅ **컴포넌트 언마운트 시 disconnect()**

---

Happy Coding! 🎉

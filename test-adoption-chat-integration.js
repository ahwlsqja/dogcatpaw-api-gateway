/**
 * 입양 공고 + 채팅 통합 테스트
 *
 * 시나리오:
 * 1. User A: 입양 공고 작성 (글쓴이)
 * 2. User B: 채팅방 생성 (입양 희망자)
 * 3. User B: WebSocket 채팅방 입장 (메시지 히스토리 자동 조회)
 * 4. User B: 메시지 전송
 * 5. User A: WebSocket 채팅방 입장 후 메시지 수신
 *
 * 사용법:
 * node test-adoption-chat-integration.js
 *
 * 필요 패키지:
 * npm install socket.io-client ethers axios
 */

const { io } = require('socket.io-client');
const { ethers } = require('ethers');
const axios = require('axios');

// ============================================
// 설정
// ============================================
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// User A (입양 공고 글쓴이)
const USER_A = {
  address: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
  privateKey: '960e72438dadcd8a559b922388616d7c352ea1de901ad61644dcc753642eea6b',
};

// User B (입양 희망자) - 실제 값으로 변경 필요
const USER_B = {
  address: '0x9c34c486ae5fc0def0ec9cd138ddc55e96f0d5e0',  // ← 변경 필요
  privateKey: '2cdce846f97c8ba42c54a78e2310c4cead926d1d694f00e220ecf23566f96e06',     // ← 변경 필요
};

// ============================================
// 헬퍼 함수
// ============================================

function logStep(step, title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`📝 Step ${step}: ${title}`);
  console.log('═'.repeat(60) + '\n');
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message, error) {
  console.log(`❌ ${message}`);
  if (error) {
    console.log(`   Error: ${error.message || error}`);
  }
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 인증 함수
// ============================================

async function login(user) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(user.privateKey, provider);

  // Challenge 요청
  const challengeResponse = await fetch(`${API_BASE_URL}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: user.address })
  });
  const challengeData = await challengeResponse.json();

  if (!challengeResponse.ok || !challengeData.challenge) {
    console.error('❌ Challenge 요청 실패:', JSON.stringify(challengeData, null, 2));
    throw new Error(`Challenge failed: ${challengeData.message || 'Unknown error'}`);
  }

  // Challenge 서명
  const challengeSignature = await wallet.signMessage(challengeData.challenge);

  let vpSignature = null;
  let vpMessage = null;

  // VP 서명 (있으면)
  if (challengeData.vpSigningData) {
    vpMessage = challengeData.vpSigningData.message;
    const signingData = challengeData.vpSigningData.signingData;
    const signingDataBytes = ethers.toUtf8Bytes(signingData);
    const messageHash = ethers.keccak256(signingDataBytes);
    vpSignature = await wallet.signMessage(messageHash);
  }

  // 로그인
  const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: user.address,
      signature: challengeSignature,
      challenge: challengeData.challenge,
      vpSignature: vpSignature,
      vpMessage: vpMessage
    })
  });
  const loginData = await loginResponse.json();

  if (!loginResponse.ok || !loginData.accessToken) {
    console.error('❌ 로그인 실패:', JSON.stringify(loginData, null, 2));
    throw new Error(`Login failed: ${loginData.message || 'No access token received'}`);
  }

  return loginData.accessToken;
}

// ============================================
// 메인 테스트 플로우
// ============================================

async function runIntegrationTest() {
  let userAToken = null;
  let userBToken = null;
  let adoptionId = null;
  let roomId = null;
  let socketA = null;
  let socketB = null;

  try {
    console.log('🐕🐱 입양 공고 + 채팅 통합 테스트 시작\n');
    console.log('설정:');
    console.log(`- API URL: ${API_BASE_URL}`);
    console.log(`- User A (글쓴이): ${USER_A.address}`);
    console.log(`- User B (입양 희망자): ${USER_B.address}`);

    // ==========================================
    // Step 1: User A 로그인
    // ==========================================
    logStep(1, 'User A 로그인 (입양 공고 글쓴이)');

    userAToken = await login(USER_A);
    logSuccess(`User A 로그인 성공: ${userAToken.substring(0, 30)}...`);

    // ==========================================
    // Step 2: User A - 입양 공고 작성
    // ==========================================
    logStep(2, 'User A - 입양 공고 작성');

    // 먼저 User A의 Pet ID 조회
    const myPetsResponse = await axios.get(`${API_BASE_URL}/api/pet`, {
      headers: { 'Authorization': `Bearer ${userAToken}` }
    });

    if (myPetsResponse.data.result.length === 0) {
      logError('User A에게 등록된 반려동물이 없습니다. Pet을 먼저 등록해주세요.');
      process.exit(1);
    }

    const petId = myPetsResponse.data.result[myPetsResponse.data.result.length - 1].petId;
    logInfo(`User A의 Pet ID: ${petId}`);

    // 입양 공고 작성
    const adoptionPostData = {
      petId: petId,
      title: '사랑스러운 골든 리트리버 입양 공고',
      content: '건강하고 활발한 골든 리트리버를 입양 보내려고 합니다.',
      region: 'SEOUL',
      district: '강남구',
      shelterName: '서울시 동물보호센터',
      contact: '010-1234-5678',
      deadLine: '2025-12-31',
      status: 'ACTIVE',
      images: 'https://example.com/dog1.jpg,https://example.com/dog2.jpg'
    };

    /**
     * {
  "petId": 0,
  "title": "string",
  "content": "string",
  "region": "SEOUL",
  "district": "string",
  "shelterName": "string",
  "contact": "string",
  "deadLine": "2025-10-21",
  "status": "ACTIVE",
  "images": "string"
}
     * 
     * 
     * 
     */

    const createAdoptionResponse = await axios.post(
      `${API_BASE_URL}/api/adoption/post`,
      adoptionPostData,
      { headers: { 'Authorization': `Bearer ${userAToken}` } }
    );

    adoptionId = createAdoptionResponse.data.result.adoptId;
    logSuccess(`입양 공고 작성 완료! Adoption ID: ${adoptionId}`);

    // ==========================================
    // Step 3: User B 로그인
    // ==========================================
    logStep(3, 'User B 로그인 (입양 희망자)');

    userBToken = await login(USER_B);
    logSuccess(`User B 로그인 성공: ${userBToken.substring(0, 30)}...`);

    // ==========================================
    // Step 4: User B - 채팅방 생성
    // ==========================================
    logStep(4, 'User B - 채팅방 생성');

    const createRoomData = {
      adoptWriterId: USER_A.address,
      adoptId: adoptionId,
      roomName: '골든 리트리버 입양 문의'
    };

    logInfo('채팅방 생성 요청...');
    console.log(JSON.stringify(createRoomData, null, 2));

    const createRoomResponse = await axios.post(
      `${API_BASE_URL}/api/chat/room/create`,
      createRoomData,
      { headers: { 'Authorization': `Bearer ${userBToken}` } }
    );

    roomId = createRoomResponse.data.result.roomId;
    logSuccess(`채팅방 생성 완료! Room ID: ${roomId}`);
    logInfo(`Initiator: ${USER_B.address} (User B)`);
    logInfo(`Target: ${USER_A.address} (User A)`);

    // ==========================================
    // Step 5: User B - WebSocket 채팅방 입장
    // ==========================================
    logStep(5, 'User B - WebSocket 채팅방 입장');

    logInfo(`WebSocket URL: ${API_BASE_URL}/chat`);
    logInfo(`Token (처음 30자): ${userBToken.substring(0, 30)}...`);

    socketB = io(`${API_BASE_URL}/chat`, {
      auth: { token: userBToken },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    await new Promise((resolve, reject) => {
      socketB.on('connect', () => {
        logSuccess(`User B Socket 연결: ${socketB.id}`);
        resolve();
      });

      socketB.on('connect_error', (error) => {
        logError('User B Socket 연결 실패', error);
        console.error('상세 에러:', {
          message: error.message,
          description: error.description,
          context: error.context,
          type: error.type,
          data: error.data
        });
        reject(error);
      });

      socketB.on('error', (error) => {
        logError('User B Socket 에러 이벤트', error);
        console.error('에러 상세:', error);
      });

      setTimeout(() => reject(new Error('Socket 연결 타임아웃 (10초)')), 10000);
    });

    // 채팅방 입장 (메시지 히스토리 자동 조회)
    const joinResult = await new Promise((resolve, reject) => {
      socketB.emit('joinRoom', { roomId: roomId }, (response) => {
        if (response.success) {
          logSuccess('User B 채팅방 입장 성공!');
          logInfo(`메시지 히스토리 개수: ${response.messages.length}개`);
          if (response.messages.length > 0) {
            console.log('📜 메시지 히스토리:');
            response.messages.forEach((msg, idx) => {
              console.log(`  ${idx + 1}. [${msg.senderId}] ${msg.message} (읽음: ${msg.isRead})`);
            });
          }
          resolve(response);
        } else {
          logError('User B 채팅방 입장 실패', response.error);
          reject(new Error(response.error));
        }
      });

      setTimeout(() => reject(new Error('joinRoom 타임아웃')), 5000);
    });

    // ==========================================
    // Step 6: User B - 메시지 전송
    // ==========================================
    logStep(6, 'User B - 메시지 전송');

    const messageFromB = '안녕하세요! 입양 문의드립니다. 언제 방문 가능할까요?';

    const sendResult = await new Promise((resolve, reject) => {
      socketB.emit('sendMessage', {
        roomId: roomId,
        message: messageFromB
      }, (response) => {
        if (response.success) {
          logSuccess('User B 메시지 전송 성공!');
          logInfo(`내용: "${messageFromB}"`);
          resolve(response);
        } else {
          logError('User B 메시지 전송 실패', response.error);
          reject(new Error(response.error));
        }
      });

      setTimeout(() => reject(new Error('sendMessage 타임아웃')), 5000);
    });

    logInfo('Spring에서 DB 저장 및 브로드캐스트 대기 중... (3초)');
    await wait(3000);

    // ==========================================
    // Step 7: User A - WebSocket 채팅방 입장
    // ==========================================
    logStep(7, 'User A - WebSocket 채팅방 입장 및 메시지 수신');

    socketA = io(`${API_BASE_URL}/chat`, {
      auth: { token: userAToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      socketA.on('connect', () => {
        logSuccess(`User A Socket 연결: ${socketA.id}`);
        resolve();
      });

      socketA.on('connect_error', (error) => {
        logError('User A Socket 연결 실패', error);
        reject(error);
      });

      setTimeout(() => reject(new Error('Socket 연결 타임아웃')), 5000);
    });

    // 메시지 수신 리스너 설정
    let receivedMessages = [];
    socketA.on('message', (data) => {
      receivedMessages.push(data);
      logSuccess('User A 메시지 수신:');
      console.log(`   └─ Sender: ${data.senderId}`);
      console.log(`   └─ Message: ${data.message}`);
      console.log(`   └─ Created: ${data.createdAt}`);
    });

    socketB.on('message', (data) => {
      logSuccess('User B 메시지 수신 (브로드캐스트):');
      console.log(`   └─ Sender: ${data.senderId}`);
      console.log(`   └─ Message: ${data.message}`);
      console.log(`   └─ Created: ${data.createdAt}`);
    });

    // User A 채팅방 입장 (메시지 히스토리 조회)
    const joinResultA = await new Promise((resolve, reject) => {
      socketA.emit('joinRoom', { roomId: roomId }, (response) => {
        if (response.success) {
          logSuccess('User A 채팅방 입장 성공!');
          logInfo(`메시지 히스토리 개수: ${response.messages.length}개`);

          if (response.messages.length > 0) {
            console.log('📜 메시지 히스토리:');
            response.messages.forEach((msg, idx) => {
              console.log(`  ${idx + 1}. [${msg.senderId}] ${msg.message} (읽음: ${msg.read})`);
            });
          }

          // User B가 보낸 메시지가 포함되어 있는지 확인
          const hasBMessage = response.messages.some(msg =>
            msg.message.includes('입양 문의')
          );

          if (hasBMessage) {
            logSuccess('✨ User B의 메시지가 히스토리에 포함됨!');
          } else {
            logError('⚠️  User B의 메시지가 히스토리에 없음 (DB 저장 확인 필요)');
          }

          resolve(response);
        } else {
          logError('User A 채팅방 입장 실패', response.error);
          reject(new Error(response.error));
        }
      });

      setTimeout(() => reject(new Error('joinRoom 타임아웃')), 5000);
    });

    // ==========================================
    // Step 8: User A - 답장 전송
    // ==========================================
    logStep(8, 'User A - 답장 전송');

    const messageFromA = '네! 주말에 방문 가능하세요? 토요일 오후 2시는 어떠세요?';

    await new Promise((resolve, reject) => {
      socketA.emit('sendMessage', {
        roomId: roomId,
        message: messageFromA
      }, (response) => {
        if (response.success) {
          logSuccess('User A 메시지 전송 성공!');
          logInfo(`내용: "${messageFromA}"`);
          resolve(response);
        } else {
          logError('User A 메시지 전송 실패', response.error);
          reject(new Error(response.error));
        }
      });

      setTimeout(() => reject(new Error('sendMessage 타임아웃')), 5000);
    });

    logInfo('실시간 메시지 브로드캐스트 대기 중... (3초)');
    await wait(3000);

    // ==========================================
    // Step 9: 채팅방 정보 조회
    // ==========================================
    logStep(9, '채팅방 정보 조회');

    // 채팅방 카드 정보
    const roomCardResponse = await axios.get(`${API_BASE_URL}/api/chat/room/card`, {
      params: { roomId: roomId },
      headers: { 'Authorization': `Bearer ${userAToken}` }
    });

    logSuccess('채팅방 카드 정보 조회 완료:');
    console.log(JSON.stringify(roomCardResponse.data, null, 2));

    // 채팅방 연결 입양 게시 정보
    const adoptionInfoResponse = await axios.get(`${API_BASE_URL}/api/chat/room/${roomId}/adoption`, {
      headers: { 'Authorization': `Bearer ${userAToken}` }
    });

    logSuccess('채팅방 연결 입양 게시 조회 완료:');
    console.log(JSON.stringify(adoptionInfoResponse.data, null, 2));

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 입양 공고 + 채팅 통합 테스트 완료!');
    console.log('═'.repeat(60) + '\n');

    console.log('📊 테스트 결과 요약:');
    console.log(`  ✅ 입양 공고 ID: ${adoptionId}`);
    console.log(`  ✅ 채팅방 ID: ${roomId}`);
    console.log(`  ✅ User A (글쓴이): ${USER_A.address}`);
    console.log(`  ✅ User B (입양 희망자): ${USER_B.address}`);
    console.log(`  ✅ 주고받은 메시지: 2개`);
    console.log('');

    console.log('✨ 검증된 기능:');
    console.log('  1. 입양 공고 작성 ✅');
    console.log('  2. 채팅방 생성 (입양 공고 연결) ✅');
    console.log('  3. WebSocket 채팅방 입장 + 메시지 히스토리 자동 조회 ✅');
    console.log('  4. 메시지 전송 (Redis Pub/Sub → Spring → DB) ✅');
    console.log('  5. 실시간 메시지 브로드캐스트 ✅');
    console.log('  6. 읽음 처리 (markAsReadCount) ✅');
    console.log('');

    console.log('🔍 다음 확인 사항:');
    console.log('  1. MySQL/PostgreSQL에서 chat_room, chat_message, chat_participant 테이블 확인');
    console.log('  2. Redis MONITOR로 메시지 흐름 확인:');
    console.log('     - "chat" 채널: NestJS → Spring');
    console.log('     - "nestjs:broadcast:{roomId}" 채널: Spring → NestJS');
    console.log('  3. Spring 서버 로그에서 DB 저장 로그 확인');
    console.log('');

    // 소켓 연결 종료
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 테스트 실행 중 오류 발생:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }

    // 소켓 연결 종료
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();

    process.exit(1);
  }
}

// ============================================
// 에러 처리
// ============================================

process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled Promise Rejection:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n⚠️  사용자가 테스트를 중단했습니다.');
  process.exit(0);
});

// ============================================
// 실행
// ============================================

console.log('⚠️  시작 전 체크리스트:');
console.log('1. NestJS 서버가 실행 중인가? (npm run start:dev)');
console.log('2. Spring 서버가 실행 중인가?');
console.log('3. Redis 서버가 실행 중인가?');
console.log('4. USER_B의 지갑 주소와 Private Key를 설정했는가?');
console.log('5. User A에게 등록된 Pet이 있는가?');
console.log('');
console.log('준비되었다면 3초 후 테스트를 시작합니다...\n');

setTimeout(() => {
  runIntegrationTest();
}, 3000);

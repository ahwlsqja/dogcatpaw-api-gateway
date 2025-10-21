/**
 * NestJS 채팅 통합 테스트 스크립트
 *
 * 사용법:
 * node test-chat-integration.js
 *
 * 필요 패키지:
 * npm install socket.io-client
 */

const { io } = require('socket.io-client');

// ============================================
// 설정 (실제 값으로 변경 필요)
// ============================================
const GATEWAY_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';  // ← 실제 JWT 토큰으로 변경
const TEST_ROOM_ID = 1;  // ← 실제 채팅방 ID로 변경

// ============================================
// 테스트 시나리오
// ============================================

console.log('🚀 채팅 통합 테스트 시작\n');
console.log('설정:');
console.log(`- Gateway URL: ${GATEWAY_URL}`);
console.log(`- Room ID: ${TEST_ROOM_ID}`);
console.log(`- Token: ${JWT_TOKEN.substring(0, 20)}...`);
console.log('\n' + '='.repeat(50) + '\n');

// 소켓 연결
const socket = io(`${GATEWAY_URL}/chat`, {
  auth: {
    token: JWT_TOKEN
  },
  transports: ['websocket'],
});

let testsPassed = 0;
let testsFailed = 0;

// ============================================
// 헬퍼 함수
// ============================================

function logSuccess(message) {
  console.log(`✅ ${message}`);
  testsPassed++;
}

function logError(message, error) {
  console.log(`❌ ${message}`);
  if (error) {
    console.log(`   Error: ${error.message || error}`);
  }
  testsFailed++;
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 테스트 1: 연결 테스트
// ============================================

socket.on('connect', () => {
  logSuccess(`연결 성공: Socket ID = ${socket.id}`);

  // 연결 성공 후 테스트 시작
  runTests();
});

socket.on('connect_error', (error) => {
  logError('연결 실패', error);
  console.log('\n⚠️  연결 실패 원인 체크리스트:');
  console.log('1. NestJS 서버가 실행 중인가? (npm run start:dev)');
  console.log('2. JWT 토큰이 유효한가?');
  console.log('3. Gateway URL이 올바른가?');
  console.log('4. VP 인증이 완료되었는가?');
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  logInfo(`연결 종료: ${reason}`);
});

// ============================================
// 테스트 2: 채팅방 입장
// ============================================

async function testJoinRoom() {
  return new Promise((resolve) => {
    logInfo(`\n📍 테스트: 채팅방 ${TEST_ROOM_ID} 입장 시도...`);

    socket.emit('joinRoom', { roomId: TEST_ROOM_ID }, (response) => {
      if (response.success) {
        logSuccess(`채팅방 입장 성공: ${response.message}`);
        resolve(true);
      } else {
        logError('채팅방 입장 실패', response.error);
        console.log('\n⚠️  입장 실패 원인 체크리스트:');
        console.log('1. 채팅방 ID가 존재하는가?');
        console.log('2. 사용자가 채팅방 참여자인가? (chat_participant 테이블 확인)');
        console.log('3. Spring 서버의 /api/chat/room/check-permission API가 동작하는가?');
        resolve(false);
      }
    });
  });
}

// ============================================
// 테스트 3: 메시지 수신 리스너
// ============================================

function setupMessageListener() {
  logInfo('\n📡 메시지 수신 리스너 설정...');

  socket.on('message', (data) => {
    logSuccess('메시지 수신:');
    console.log('   └─ Sender:', data.senderId);
    console.log('   └─ Message:', data.message);
    console.log('   └─ Created:', data.createdAt);
    console.log('   └─ isRead:', data.isRead);
  });

  logSuccess('메시지 리스너 설정 완료');
}

// ============================================
// 테스트 4: 메시지 전송
// ============================================

async function testSendMessage() {
  return new Promise((resolve) => {
    const testMessage = `테스트 메시지 ${new Date().toLocaleTimeString()}`;

    logInfo(`\n📤 테스트: 메시지 전송 시도...`);
    logInfo(`   메시지 내용: "${testMessage}"`);

    socket.emit('sendMessage', {
      roomId: TEST_ROOM_ID,
      message: testMessage
    }, (response) => {
      if (response.success) {
        logSuccess('메시지 전송 성공');
        console.log('   └─ 응답:', JSON.stringify(response.data, null, 2));
        resolve(true);
      } else {
        logError('메시지 전송 실패', response.error);
        console.log('\n⚠️  전송 실패 원인 체크리스트:');
        console.log('1. Redis 서버가 실행 중인가?');
        console.log('2. Spring 서버가 Redis "chat" 채널을 구독 중인가?');
        console.log('3. Member가 DB에 등록되어 있는가?');
        console.log('4. ChatParticipant가 존재하는가?');
        resolve(false);
      }
    });
  });
}

// ============================================
// 테스트 5: 브로드캐스트 수신 대기
// ============================================

async function testBroadcastReceive() {
  logInfo('\n⏳ Spring에서 브로드캐스트 수신 대기 (5초)...');
  logInfo('   Spring이 DB 저장 후 Redis "nestjs:broadcast:X"로 재발행하는지 확인');

  await wait(5000);

  logInfo('   대기 완료');
  console.log('\n   ℹ️  메시지가 위에 표시되었다면 브로드캐스트 성공!');
  console.log('   ℹ️  표시되지 않았다면:');
  console.log('      1. Spring RedisPubSubService.onMessage() 확인');
  console.log('      2. Redis "nestjs:broadcast:{roomId}" 발행 확인');
  console.log('      3. NestJS Redis 구독 패턴 확인 (nestjs:broadcast:*)');
}

// ============================================
// 테스트 6: 채팅방 퇴장
// ============================================

async function testLeaveRoom() {
  return new Promise((resolve) => {
    logInfo(`\n🚪 테스트: 채팅방 ${TEST_ROOM_ID} 퇴장 시도...`);

    socket.emit('leaveRoom', { roomId: TEST_ROOM_ID }, (response) => {
      if (response.success) {
        logSuccess(`채팅방 퇴장 성공: ${response.message}`);
        resolve(true);
      } else {
        logError('채팅방 퇴장 실패', response.error);
        resolve(false);
      }
    });
  });
}

// ============================================
// 전체 테스트 실행
// ============================================

async function runTests() {
  try {
    // 메시지 리스너 먼저 설정
    setupMessageListener();

    await wait(1000);

    // 1. 채팅방 입장
    const joinSuccess = await testJoinRoom();
    if (!joinSuccess) {
      console.log('\n❌ 채팅방 입장 실패로 테스트 중단');
      printSummary();
      process.exit(1);
    }

    await wait(1000);

    // 2. 메시지 전송
    const sendSuccess = await testSendMessage();

    // 3. 브로드캐스트 수신 대기
    await testBroadcastReceive();

    // 4. 채팅방 퇴장
    await testLeaveRoom();

    await wait(1000);

    // 결과 출력
    printSummary();

    // 종료
    socket.disconnect();
    process.exit(testsFailed > 0 ? 1 : 0);

  } catch (error) {
    logError('테스트 실행 중 오류 발생', error);
    console.error(error);
    socket.disconnect();
    process.exit(1);
  }
}

// ============================================
// 결과 요약
// ============================================

function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(50));
  console.log(`✅ 성공: ${testsPassed}개`);
  console.log(`❌ 실패: ${testsFailed}개`);
  console.log('='.repeat(50) + '\n');

  if (testsFailed === 0) {
    console.log('🎉 모든 테스트 통과!');
    console.log('\n다음 단계:');
    console.log('1. Spring 서버 로그 확인 (DB 저장 로그)');
    console.log('2. MySQL/PostgreSQL에서 chat_message 테이블 확인');
    console.log('3. Redis MONITOR로 메시지 흐름 확인');
    console.log('4. 프론트엔드 통합 시작');
  } else {
    console.log('⚠️  일부 테스트 실패');
    console.log('\n디버깅 가이드:');
    console.log('1. NestJS 로그 확인: npm run start:dev');
    console.log('2. Spring 로그 확인: application.log');
    console.log('3. Redis 확인: redis-cli MONITOR');
    console.log('4. DB 확인: chat_participant, member 테이블');
  }
}

// ============================================
// 추가 디버깅 정보
// ============================================

socket.onAny((event, ...args) => {
  if (event !== 'message') { // message는 위에서 처리
    console.log(`🔔 이벤트 수신: [${event}]`, args);
  }
});

socket.onAnyOutgoing((event, ...args) => {
  // 전송 이벤트 로깅 (옵션)
  // console.log(`📤 이벤트 전송: [${event}]`, args);
});

// ============================================
// 에러 처리
// ============================================

process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled Promise Rejection:', error);
  socket.disconnect();
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n⚠️  사용자가 테스트를 중단했습니다.');
  socket.disconnect();
  process.exit(0);
});

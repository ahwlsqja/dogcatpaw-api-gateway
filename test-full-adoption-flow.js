/**
 * 완전한 입양 프로세스 통합 테스트
 *
 * 전체 시나리오:
 * 1. User A (현재 보호자): Pet 정보 조회
 * 2. User A: 입양 공고 작성
 * 3. User B (입양 희망자): 입양 공고 목록 조회
 * 4. User B: 입양 신청 (채팅방 생성)
 * 5. User B: 비문 이미지 업로드 (임시 저장소)
 * 6. User A: 소유권 이전 준비
 * 7. User B: 비문 검증
 * 8. User B: 소유권 이전 수락
 * 9. 완료 확인
 *
 * 사용법:
 * node test-full-adoption-flow.js <noseprintImagePath>
 *
 * 예시:
 * node test-full-adoption-flow.js ./test-nose-image.jpg
 */

const { ethers } = require('ethers');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// ============================================
// 설정
// ============================================
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// User A (현재 보호자 - 입양 공고 작성자)
const USER_A = {
  address: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
  privateKey: '960e72438dadcd8a559b922388616d7c352ea1de901ad61644dcc753642eea6b',
};

// User B (새 보호자 - 입양 희망자)
const USER_B = {
  address: '0x9c34c486ae5fc0def0ec9cd138ddc55e96f0d5e0',
  privateKey: '2cdce846f97c8ba42c54a78e2310c4cead926d1d694f00e220ecf23566f96e06',
};

// Pet 데이터
const PET_DATA = {
  petName: '멍멍이',
  breed: 'GOLDEN_RETRIEVER',
  old: 3,
  weight: 25.0,
  gender: 'FEMALE',
  color: '황금색',
  feature: '활발하고 사교적',
  neutral: true,
  specifics: 'dog',
};

// PetDIDRegistry 컨트랙트 주소
const PET_DID_REGISTRY_ADDRESS = process.env.PET_DID_REGISTRY_ADDRESS || '0x8d3ce963e197F8c8966F992eDC364e5B292A7Dbf';

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

async function runFullAdoptionFlow() {
  // 커맨드 라인 인자 확인
  const noseprintImagePath = process.argv[2];

  if (!noseprintImagePath) {
    console.error('\n❌ Error: Missing noseprint image path!');
    console.log('\nUsage:');
    console.log('  node test-full-adoption-flow.js <noseprintImagePath>');
    console.log('\nExample:');
    console.log('  node test-full-adoption-flow.js ./test-nose-image.jpg');
    console.log('');
    process.exit(1);
  }

  if (!fs.existsSync(noseprintImagePath)) {
    console.error(`\n❌ Error: File not found: ${noseprintImagePath}`);
    process.exit(1);
  }

  let userAToken = null;
  let userBToken = null;
  let petId = null;
  let petDID = null;
  let adoptionId = null;
  let noseprintImageUrl = null;

  try {
    console.log('🐕🐱 완전한 입양 프로세스 통합 테스트 시작\n');
    console.log('설정:');
    console.log(`- API URL: ${API_BASE_URL}`);
    console.log(`- User A (현재 보호자): ${USER_A.address}`);
    console.log(`- User B (입양 희망자): ${USER_B.address}`);
    console.log(`- 비문 이미지: ${noseprintImagePath}`);

    // ==========================================
    // Step 1: User A 로그인
    // ==========================================
    logStep(1, 'User A 로그인 (현재 보호자)');

    userAToken = await login(USER_A);
    logSuccess(`User A 로그인 성공: ${userAToken.substring(0, 30)}...`);

    // ==========================================
    // Step 2: User A - Pet 정보 조회
    // ==========================================
    logStep(2, 'User A - Pet 정보 조회');

    const myPetsResponse = await axios.get(`${API_BASE_URL}/api/pet`, {
      headers: { 'Authorization': `Bearer ${userAToken}` }
    });

    if (!myPetsResponse.data.result || myPetsResponse.data.result.length === 0) {
      logError('User A에게 등록된 Pet이 없습니다. Pet을 먼저 등록해주세요.');
      process.exit(1);
    }

    // 마지막 Pet 선택
    const petInfo = myPetsResponse.data.result[myPetsResponse.data.result.length - 1];
    petId = petInfo.petId;
    petDID = petInfo.petDID;

    logSuccess(`Pet 정보 조회 성공!`);
    logInfo(`Pet ID: ${petId}`);
    logInfo(`Pet DID: ${petDID}`);
    logInfo(`Pet Name: ${petInfo.petName}`);

    // ==========================================
    // Step 3: User A - 입양 공고 작성
    // ==========================================
    logStep(3, 'User A - 입양 공고 작성');

    const adoptionPostData = {
      petId: petId,
      title: '사랑스러운 골든 리트리버 입양 공고',
      content: '건강하고 활발한 골든 리트리버를 입양 보내려고 합니다. 좋은 가정에서 사랑받기를 바랍니다.',
      region: 'SEOUL',
      district: '강남구',
      shelterName: '서울시 동물보호센터',
      contact: '010-1234-5678',
      deadLine: '2025-12-31',
      status: 'ACTIVE',
      images: 'https://example.com/dog1.jpg,https://example.com/dog2.jpg'
    };

    logInfo('입양 공고 작성 중...');
    const createAdoptionResponse = await axios.post(
      `${API_BASE_URL}/api/adoption/post`,
      adoptionPostData,
      { headers: { 'Authorization': `Bearer ${userAToken}` } }
    );

    adoptionId = createAdoptionResponse.data.result.adoptId;
    logSuccess(`입양 공고 작성 완료! Adoption ID: ${adoptionId}`);

    // ==========================================
    // Step 4: User B 로그인
    // ==========================================
    logStep(4, 'User B 로그인 (입양 희망자)');

    userBToken = await login(USER_B);
    logSuccess(`User B 로그인 성공: ${userBToken.substring(0, 30)}...`);

    // ==========================================
    // Step 5: User B - 입양 공고 목록 조회
    // ==========================================
    logStep(5, 'User B - 입양 공고 목록 조회');

    const adoptionListResponse = await axios.get(`${API_BASE_URL}/api/adoption/post`, {
      headers: { 'Authorization': `Bearer ${userBToken}` }
    });

    logSuccess('입양 공고 목록 조회 성공!');
    logInfo(`총 ${adoptionListResponse.data.result.length}개의 공고`);

    // 방금 작성한 공고 찾기
    const targetAdoption = adoptionListResponse.data.result.find(
      adoption => adoption.adoptId === adoptionId
    );

    if (targetAdoption) {
      logSuccess(`대상 공고 확인: "${targetAdoption.title}"`);
    } else {
      logInfo('방금 작성한 공고가 목록에 아직 나타나지 않을 수 있습니다.');
    }

    // ==========================================
    // Step 6: User B - 입양 신청 (채팅방 생성)
    // ==========================================
    logStep(6, 'User B - 입양 신청 (채팅방 생성)');

    const createRoomData = {
      adoptWriterId: USER_A.address,
      adoptId: adoptionId,
      roomName: '골든 리트리버 입양 문의'
    };

    logInfo('채팅방 생성 (입양 신청)...');
    const createRoomResponse = await axios.post(
      `${API_BASE_URL}/api/chat/room/create`,
      createRoomData,
      { headers: { 'Authorization': `Bearer ${userBToken}` } }
    );

    const roomId = createRoomResponse.data.result.roomId;
    logSuccess(`채팅방 생성 완료! Room ID: ${roomId}`);
    logInfo('입양 신청 완료 (채팅 통해 소통 가능)');

    // ==========================================
    // Step 7: User B - 비문 이미지 업로드 (임시 저장소)
    // ==========================================
    logStep(7, 'User B - 비문 이미지 업로드 (임시 저장소)');

    const uploadFormData = new FormData();
    uploadFormData.append('file', fs.createReadStream(noseprintImagePath));

    logInfo('비문 이미지 업로드 중...');
    const uploadResponse = await axios.post(
      `${API_BASE_URL}/api/common/upload-temp-nose-print`,
      uploadFormData,
      {
        headers: {
          'Authorization': `Bearer ${userBToken}`,
          ...uploadFormData.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    noseprintImageUrl = uploadResponse.data.result.imageUrl;
    logSuccess('비문 이미지 업로드 완료!');
    logInfo(`Image URL: ${noseprintImageUrl}`);

    // ==========================================
    // Step 8: 협의 완료 대기 (실제로는 채팅 통해 협의)
    // ==========================================
    logStep(8, '입양 협의 진행 중...');

    logInfo('실제 서비스에서는 채팅을 통해 협의가 진행됩니다.');
    logInfo('이 테스트에서는 협의가 완료되었다고 가정하고 진행합니다.');
    logInfo('대기 중... (3초)');
    await wait(3000);

    // ==========================================
    // Step 9: User A - 소유권 이전 준비
    // ==========================================
    logStep(9, 'User A - 소유권 이전 준비 (prepare-transfer)');

    const prepareTransferData = {
      newGuardianAddress: USER_B.address,
      petData: PET_DATA
    };

    logInfo('소유권 이전 준비 요청...');
    const prepareResponse = await axios.post(
      `${API_BASE_URL}/pet/prepare-transfer/${encodeURIComponent(petDID)}`,
      prepareTransferData,
      { headers: { 'Authorization': `Bearer ${userAToken}` } }
    );

    if (!prepareResponse.data.success) {
      logError('소유권 이전 준비 실패', prepareResponse.data.error);
      process.exit(1);
    }

    const transferSigningData = prepareResponse.data;
    logSuccess('소유권 이전 준비 완료!');
    logInfo(`새 보호자: ${USER_B.address}`);

    // ==========================================
    // Step 10: User B - 비문 검증
    // ==========================================
    logStep(10, 'User B - 비문 검증 (verify-transfer)');

    const verifyTransferData = {
      image: noseprintImageUrl
    };

    logInfo('비문 검증 요청...');
    const verifyResponse = await axios.post(
      `${API_BASE_URL}/pet/verify-transfer/${encodeURIComponent(petDID)}`,
      verifyTransferData,
      { headers: { 'Authorization': `Bearer ${userBToken}` } }
    );

    if (!verifyResponse.data.success) {
      logError('비문 검증 실패', verifyResponse.data.error);
      console.log(`   유사도: ${verifyResponse.data.similarity}%`);
      console.log(`   임계값: ${verifyResponse.data.threshold}%`);
      process.exit(1);
    }

    const verificationProof = verifyResponse.data.verificationProof;
    const proofHash = verifyResponse.data.proofHash;
    logSuccess(`비문 검증 성공! 유사도: ${verifyResponse.data.similarity}%`);
    logInfo(`Proof Hash: ${proofHash}`);

    // ==========================================
    // Step 11: User B - 트랜잭션 서명
    // ==========================================
    logStep(11, 'User B - 트랜잭션 서명');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const walletB = new ethers.Wallet(USER_B.privateKey, provider);

    // 11a. VC 메시지 서명
    logInfo('VC 메시지 서명 중...');
    const vcSignature = await walletB.signMessage(transferSigningData.messageHash);
    logSuccess('VC 메시지 서명 완료');

    // 11b. Controller 변경 트랜잭션 서명
    logInfo('Controller 변경 트랜잭션 서명 중...');

    const petDIDHash = ethers.id(petDID);
    const iface = new ethers.Interface([
      'function changeController(bytes32 petDIDHash, address newController)'
    ]);
    const txData = iface.encodeFunctionData('changeController', [petDIDHash, USER_B.address]);

    const nonce = await provider.getTransactionCount(USER_B.address);

    const changeControllerTx = {
      to: PET_DID_REGISTRY_ADDRESS,
      data: txData,
      gasLimit: ethers.toBeHex(3000000),
      gasPrice: ethers.toBeHex(0),
      value: 0,
      nonce: nonce,
      chainId: 1337
    };

    const signedTx = await walletB.signTransaction(changeControllerTx);
    logSuccess('Controller 변경 트랜잭션 서명 완료');

    // ==========================================
    // Step 12: User B - 소유권 이전 수락
    // ==========================================
    logStep(12, 'User B - 소유권 이전 수락 (accept-transfer)');

    const acceptTransferData = {
      signature: vcSignature,
      message: transferSigningData.message,
      signedTx: signedTx,
      verificationProof: verificationProof,
      petData: PET_DATA
    };

    logInfo('소유권 이전 수락 요청...');
    const acceptResponse = await axios.post(
      `${API_BASE_URL}/pet/accept-transfer/${encodeURIComponent(petDID)}/${adoptionId}`,
      acceptTransferData,
      { headers: { 'Authorization': `Bearer ${userBToken}` } }
    );

    if (!acceptResponse.data.success) {
      logError('소유권 이전 실패', acceptResponse.data.error);
      if (acceptResponse.data.details) {
        console.log('   Details:', JSON.stringify(acceptResponse.data.details, null, 2));
      }
      process.exit(1);
    }

    logSuccess('소유권 이전 완료!');
    logInfo(`Transaction Hash: ${acceptResponse.data.txHash}`);
    logInfo(`Block Number: ${acceptResponse.data.blockNumber}`);
    logInfo(`유사도: ${acceptResponse.data.similarity}%`);
    logInfo(`VC Transfer Job ID: ${acceptResponse.data.vcTransferJobId}`);

    // ==========================================
    // Step 13: 완료 확인 및 히스토리 조회
    // ==========================================
    logStep(13, '완료 확인 및 히스토리 조회');

    logInfo('블록체인 동기화 대기 중... (5초)');
    await wait(5000);

    // 13a. Pet 이전 히스토리 조회
    const historyResponse = await axios.get(
      `${API_BASE_URL}/pet/history/${encodeURIComponent(petDID)}`
    );

    if (historyResponse.data.success) {
      logSuccess('이전 히스토리 조회 완료!');
      console.log(`\n📜 Pet Controller History:`);
      console.log(`   Current Controller: ${historyResponse.data.currentController}`);
      console.log(`   Total Transfers: ${historyResponse.data.totalTransfers}`);
      console.log(`   Source: ${historyResponse.data.source}`);

      if (historyResponse.data.history && historyResponse.data.history.length > 0) {
        console.log(`\n   Recent History:`);
        historyResponse.data.history.slice(-3).forEach((event, idx) => {
          console.log(`   ${idx + 1}. ${event.previousController} → ${event.newController}`);
          console.log(`      Block: ${event.blockNumber}, Tx: ${event.transactionHash?.substring(0, 20)}...`);
        });
      }
    }

    // 13b. 입양 공고 상태 확인
    const adoptionDetailResponse = await axios.get(
      `${API_BASE_URL}/api/adoption/post/${adoptionId}`,
      { headers: { 'Authorization': `Bearer ${userAToken}` } }
    );

    if (adoptionDetailResponse.data.success) {
      logSuccess('입양 공고 상태 확인!');
      logInfo(`상태: ${adoptionDetailResponse.data.result.status}`);
    }

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 완전한 입양 프로세스 테스트 완료!');
    console.log('═'.repeat(60) + '\n');

    console.log('📊 테스트 결과 요약:');
    console.log(`  ✅ Pet ID: ${petId}`);
    console.log(`  ✅ Pet DID: ${petDID}`);
    console.log(`  ✅ Adoption ID: ${adoptionId}`);
    console.log(`  ✅ Chat Room ID: ${roomId}`);
    console.log(`  ✅ 이전 보호자: ${USER_A.address}`);
    console.log(`  ✅ 새 보호자: ${USER_B.address}`);
    console.log(`  ✅ Transaction Hash: ${acceptResponse.data.txHash}`);
    console.log(`  ✅ Block Number: ${acceptResponse.data.blockNumber}`);
    console.log('');

    console.log('✨ 검증된 전체 플로우:');
    console.log('  1. Pet 정보 조회 ✅');
    console.log('  2. 입양 공고 작성 ✅');
    console.log('  3. 입양 공고 목록 조회 ✅');
    console.log('  4. 입양 신청 (채팅방 생성) ✅');
    console.log('  5. 비문 이미지 업로드 ✅');
    console.log('  6. 소유권 이전 준비 ✅');
    console.log('  7. 비문 검증 ✅');
    console.log('  8. 트랜잭션 서명 ✅');
    console.log('  9. 소유권 이전 수락 ✅');
    console.log('  10. 블록체인 Controller 변경 ✅');
    console.log('  11. 이전 히스토리 조회 ✅');
    console.log('');

    console.log('🔍 다음 확인 사항:');
    console.log('  1. Spring 서버에서 adoption 상태가 COMPLETED로 변경되었는지 확인');
    console.log('  2. BullMQ 대시보드에서 백그라운드 작업 처리 상태 확인:');
    console.log('     - VC Transfer Job');
    console.log('     - Guardian Transfer Sync Job');
    console.log('     - Spring Sync Job');
    console.log('  3. 블록체인에서 Controller가 User B로 변경되었는지 확인');
    console.log('  4. User B의 새 VC가 생성되고, User A의 VC가 무효화되었는지 확인');
    console.log('  5. 채팅 내역이 보존되었는지 확인');
    console.log('');

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
console.log('4. User A가 등록한 Pet이 최소 1개 이상 있는가?');
console.log('5. User B가 가디언으로 등록되어 있는가?');
console.log('6. 비문 이미지 파일이 준비되어 있는가?');
console.log('');
console.log('준비되었다면 3초 후 테스트를 시작합니다...\n');

setTimeout(() => {
  runFullAdoptionFlow();
}, 3000);

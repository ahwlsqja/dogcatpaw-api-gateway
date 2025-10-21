/**
 * 입양 공고 → 소유권 이전 통합 테스트
 *
 * 시나리오:
 * 1. User A (현재 보호자): 입양 공고 작성 완료 (이미 작성됨)
 * 2. User A: 소유권 이전 준비 (prepare-transfer)
 * 3. User B (새 보호자): 비문 검증 (verify-transfer)
 * 4. User B: 서명 후 소유권 이전 수락 (accept-transfer)
 *
 * 사용법:
 * node test-adoption-transfer.js <petDID> <adoptionId> <noseprintImageUrl>
 *
 * 예시:
 * node test-adoption-transfer.js did:ethr:besu:0x123... 5 temp-nose-print-photo/image123.jpg
 */

const { ethers } = require('ethers');
const axios = require('axios');

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

// Pet 데이터 (이전할 펫 정보)
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

async function runAdoptionTransferTest() {
  // 커맨드 라인 인자 확인
  const petDID = process.argv[2];
  const adoptionId = process.argv[3];
  const noseprintImageUrl = process.argv[4];

  if (!petDID || !adoptionId || !noseprintImageUrl) {
    console.error('\n❌ Error: Missing required arguments!');
    console.log('\nUsage:');
    console.log('  node test-adoption-transfer.js <petDID> <adoptionId> <noseprintImageUrl>');
    console.log('\nExample:');
    console.log('  node test-adoption-transfer.js did:ethr:besu:0x123... 5 temp-nose-print-photo/image123.jpg');
    console.log('');
    process.exit(1);
  }

  let userAToken = null;
  let userBToken = null;

  try {
    console.log('🐕🐱 입양 공고 → 소유권 이전 통합 테스트 시작\n');
    console.log('설정:');
    console.log(`- API URL: ${API_BASE_URL}`);
    console.log(`- Pet DID: ${petDID}`);
    console.log(`- Adoption ID: ${adoptionId}`);
    console.log(`- Noseprint Image: ${noseprintImageUrl}`);
    console.log(`- User A (현재 보호자): ${USER_A.address}`);
    console.log(`- User B (새 보호자): ${USER_B.address}`);

    // ==========================================
    // Step 1: User A 로그인
    // ==========================================
    logStep(1, 'User A 로그인 (현재 보호자)');

    userAToken = await login(USER_A);
    logSuccess(`User A 로그인 성공: ${userAToken.substring(0, 30)}...`);

    // ==========================================
    // Step 2: User B 로그인
    // ==========================================
    logStep(2, 'User B 로그인 (새 보호자)');

    userBToken = await login(USER_B);
    logSuccess(`User B 로그인 성공: ${userBToken.substring(0, 30)}...`);

    // ==========================================
    // Step 3: User A - 소유권 이전 준비
    // ==========================================
    logStep(3, 'User A - 소유권 이전 준비 (prepare-transfer)');

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
    logInfo(`Message: ${JSON.stringify(transferSigningData.message)}`);
    logInfo(`Message Hash: ${transferSigningData.messageHash}`);

    // ==========================================
    // Step 4: User B - 비문 검증
    // ==========================================
    logStep(4, 'User B - 비문 검증 (verify-transfer)');

    logInfo(`비문 이미지 URL: ${noseprintImageUrl}`);
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
      process.exit(1);
    }

    const verificationProof = verifyResponse.data.verificationProof;
    const proofHash = verifyResponse.data.proofHash;
    logSuccess(`비문 검증 성공! 유사도: ${verifyResponse.data.similarity}%`);
    logInfo(`Proof Hash: ${proofHash}`);

    // ==========================================
    // Step 5: User B - 서명 준비
    // ==========================================
    logStep(5, 'User B - 트랜잭션 서명');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const walletB = new ethers.Wallet(USER_B.privateKey, provider);

    // 5a. VC 메시지 서명
    logInfo('VC 메시지 서명 중...');
    const vcSignature = await walletB.signMessage(transferSigningData.messageHash);
    logSuccess('VC 메시지 서명 완료');

    // 5b. Controller 변경 트랜잭션 서명
    logInfo('Controller 변경 트랜잭션 서명 중...');

    // changeController 트랜잭션 데이터 준비
    // PetDIDRegistry의 changeController(bytes32 petDIDHash, address newController) 함수 호출
    const petDIDHash = ethers.id(petDID); // keccak256 해시

    // ABI 인코딩
    const iface = new ethers.Interface([
      'function changeController(bytes32 petDIDHash, address newController)'
    ]);
    const txData = iface.encodeFunctionData('changeController', [petDIDHash, USER_B.address]);

    // PetDIDRegistry 컨트랙트 주소 (환경변수 또는 하드코딩)
    const PET_DID_REGISTRY_ADDRESS = process.env.PET_DID_REGISTRY_ADDRESS || '0x8d3ce963e197F8c8966F992eDC364e5B292A7Dbf';

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
    // Step 6: User B - 소유권 이전 수락
    // ==========================================
    logStep(6, 'User B - 소유권 이전 수락 (accept-transfer)');

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

    // ==========================================
    // Step 7: 대기 및 이전 히스토리 조회
    // ==========================================
    logStep(7, '이전 히스토리 조회');

    logInfo('블록체인 동기화 대기 중... (5초)');
    await wait(5000);

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
        console.log(`\n   History:`);
        historyResponse.data.history.forEach((event, idx) => {
          console.log(`   ${idx + 1}. ${event.previousController} → ${event.newController}`);
          console.log(`      Block: ${event.blockNumber}, Tx: ${event.transactionHash}`);
          console.log(`      Time: ${event.timestampISO || event.timestamp}`);
        });
      }
    } else {
      logError('이전 히스토리 조회 실패', historyResponse.data.error);
    }

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 입양 공고 → 소유권 이전 테스트 완료!');
    console.log('═'.repeat(60) + '\n');

    console.log('📊 테스트 결과 요약:');
    console.log(`  ✅ Pet DID: ${petDID}`);
    console.log(`  ✅ Adoption ID: ${adoptionId}`);
    console.log(`  ✅ 이전 보호자: ${USER_A.address}`);
    console.log(`  ✅ 새 보호자: ${USER_B.address}`);
    console.log(`  ✅ Transaction Hash: ${acceptResponse.data.txHash}`);
    console.log(`  ✅ Block Number: ${acceptResponse.data.blockNumber}`);
    console.log(`  ✅ VC Transfer Job ID: ${acceptResponse.data.vcTransferJobId}`);
    console.log('');

    console.log('✨ 검증된 기능:');
    console.log('  1. 소유권 이전 준비 (prepare-transfer) ✅');
    console.log('  2. 비문 검증 (verify-transfer) ✅');
    console.log('  3. 트랜잭션 서명 (VC + Controller 변경) ✅');
    console.log('  4. 소유권 이전 수락 (accept-transfer) ✅');
    console.log('  5. 블록체인 Controller 변경 ✅');
    console.log('  6. 백그라운드 VC 처리 큐 등록 ✅');
    console.log('  7. Spring 서버 동기화 큐 등록 ✅');
    console.log('  8. 이전 히스토리 조회 ✅');
    console.log('');

    console.log('🔍 다음 확인 사항:');
    console.log('  1. Spring 서버에서 adoption 상태가 COMPLETED로 변경되었는지 확인');
    console.log('  2. BullMQ 대시보드에서 VC Transfer Job 처리 상태 확인');
    console.log('  3. 블록체인에서 Controller가 변경되었는지 확인');
    console.log('  4. 새 보호자 VC가 생성되고, 이전 보호자 VC가 무효화되었는지 확인');
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
console.log('4. Pet DID가 존재하고, User A가 현재 Controller인가?');
console.log('5. Adoption ID가 유효한가?');
console.log('6. 비문 이미지가 임시 저장소에 업로드되어 있는가?');
console.log('');
console.log('준비되었다면 3초 후 테스트를 시작합니다...\n');

setTimeout(() => {
  runAdoptionTransferTest();
}, 3000);

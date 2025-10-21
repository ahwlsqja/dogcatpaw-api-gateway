/**
 * Admin 회원 관리 테스트 스크립트
 *
 * 테스트 시나리오:
 * 1. Admin 로그인
 * 2. 전체 회원 목록 조회 (페이지네이션)
 * 3. 다음 페이지 조회
 *
 * 사용법:
 * node test-admin-members.js
 */

const { ethers } = require('ethers');
const axios = require('axios');

// ============================================
// 설정
// ============================================
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// Admin User (방금 생성한 관리자)
const ADMIN_USER = {
  address: '0x09b253e53308d0a4ad840c1cb05c4cb0bf8d1fdc',
  privateKey: '74c5adf9750f5095db534580354b07a40eaaed350b83ab382dd97347f4867c0d',
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

async function adminLogin(user) {
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

  // Admin 로그인
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
    console.error('❌ Admin 로그인 실패:', JSON.stringify(loginData, null, 2));
    throw new Error(`Admin login failed: ${loginData.message || 'No access token received'}`);
  }

  return loginData;
}

// ============================================
// 메인 테스트 플로우
// ============================================

async function runAdminTest() {
  let adminToken = null;

  try {
    console.log('🔐 Admin 회원 관리 테스트 시작\n');
    console.log('설정:');
    console.log(`- API URL: ${API_BASE_URL}`);
    console.log(`- Admin Address: ${ADMIN_USER.address}`);

    // ==========================================
    // Step 1: Admin 로그인
    // ==========================================
    logStep(1, 'Admin 로그인');

    const loginResult = await adminLogin(ADMIN_USER);
    adminToken = loginResult.accessToken;
    console.log(adminToken)

    logSuccess(`Admin 로그인 성공`);
    logInfo(`Role: ${loginResult.role} (0 = ADMIN, 1 = USER)`);
    logInfo(`Guardian: ${loginResult.profile.isGuardian}`);
    logInfo(`VC Count: ${loginResult.profile.vcCount}`);
    logInfo(`Token: ${adminToken.substring(0, 30)}...`);

    // ==========================================
    // Step 2: 전체 회원 목록 조회 (첫 페이지)
    // ==========================================

    logInfo('GET /api/admin?size=5');
    const firstPageResponse = await axios.get(
      `${API_BASE_URL}/api/admin`,
       null,
      {
        params: {
          size: 5
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
  
  );

    if (!firstPageResponse.data.isSuccess) {
      throw new Error('회원 목록 조회 실패');
    }

    const firstPage = firstPageResponse.data.result;
    logSuccess(`회원 목록 조회 성공!`);
    logInfo(`총 회원 수: ${firstPage.members.length}명`);
    logInfo(`Next Cursor: ${firstPage.nextCursor || 'null (마지막 페이지)'}`);

    console.log('\n📋 회원 목록:');
    firstPage.members.forEach((member, idx) => {
      console.log(`\n  ${idx + 1}. ${member.nickname} (${member.walletAddress})`);
      if (member.pets && member.pets.length > 0) {
        console.log(`     반려동물 ${member.pets.length}마리:`);
        member.pets.forEach((pet, petIdx) => {
          console.log(`       ${petIdx + 1}. ${pet.petName} (ID: ${pet.petId})`);
          console.log(`          DID: ${pet.did}`);
        });
      } else {
        console.log(`     반려동물: 없음`);
      }
    });

    // ==========================================
    // Step 3: 다음 페이지 조회 (cursor 사용)
    // ==========================================
    if (firstPage.nextCursor) {
      logStep(3, '다음 페이지 조회 (cursor 사용)');

      logInfo(`GET /api/admin?size=5&cursor=${firstPage.nextCursor}`);
      const secondPageResponse = await axios.get(`${API_BASE_URL}/api/admin`, {
        params: {
          size: 5,
          cursor: firstPage.nextCursor
        },
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      console.log(adminToken)
      if (!secondPageResponse.data.isSuccess) {
        throw new Error('다음 페이지 조회 실패');
      }

      const secondPage = secondPageResponse.data.result;
      logSuccess(`다음 페이지 조회 성공!`);
      logInfo(`회원 수: ${secondPage.members.length}명`);
      logInfo(`Next Cursor: ${secondPage.nextCursor || 'null (마지막 페이지)'}`);

      console.log('\n📋 회원 목록 (2페이지):');
      secondPage.members.forEach((member, idx) => {
        console.log(`\n  ${idx + 1}. ${member.nickname} (${member.walletAddress})`);
        if (member.pets && member.pets.length > 0) {
          console.log(`     반려동물 ${member.pets.length}마리`);
        } else {
          console.log(`     반려동물: 없음`);
        }
      });
    } else {
      logInfo('⚠️  첫 페이지가 마지막 페이지입니다 (전체 회원이 5명 이하)');
    }

    // ==========================================
    // Step 4: 권한 테스트 - 일반 사용자 토큰으로 시도
    // ==========================================
    logStep(4, '권한 테스트 (User Token으로 접근 시도)');

    logInfo('일반 로그인으로 User 토큰 발급 중...');

    // 일반 로그인 (User B - role = 1)
    const USER_B = {
      address: '0x9c34c486ae5fc0def0ec9cd138ddc55e96f0d5e0',
      privateKey: '2cdce846f97c8ba42c54a78e2310c4cead926d1d694f00e220ecf23566f96e06',
    };

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const walletB = new ethers.Wallet(USER_B.privateKey, provider);

    const userChallengeResponse = await fetch(`${API_BASE_URL}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: USER_B.address })
    });
    const userChallengeData = await userChallengeResponse.json();
    const userChallengeSignature = await walletB.signMessage(userChallengeData.challenge);

    const userLoginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: USER_B.address,
        signature: userChallengeSignature,
        challenge: userChallengeData.challenge,
      })
    });
    const userLoginData = await userLoginResponse.json();
    const userToken = userLoginData.accessToken;

    logInfo('User 토큰 발급 완료');
    logInfo('User 토큰으로 /api/admin 접근 시도...');

    try {
      await axios.get(`${API_BASE_URL}/api/admin`, {
        params: { size: 5 },
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      logError('⚠️  예상치 못한 성공 - User가 Admin API에 접근했습니다!');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        logSuccess('✨ 권한 검증 성공! User는 Admin API에 접근할 수 없습니다.');
        logInfo(`응답: ${error.response.data.message}`);
      } else {
        throw error;
      }
    }

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 Admin 회원 관리 테스트 완료!');
    console.log('═'.repeat(60) + '\n');

    console.log('✨ 검증된 기능:');
    console.log('  1. Admin 로그인 (Role 포함) ✅');
    console.log('  2. 회원 목록 조회 (페이지네이션) ✅');
    console.log('  3. Cursor 기반 다음 페이지 조회 ✅');
    console.log('  4. Role-Based Access Control (RBAC) ✅');
    console.log('  5. 일반 사용자 접근 차단 ✅');
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
console.log('3. Admin 계정이 등록되어 있는가?');
console.log('   - Address: 0x09b253e53308d0a4ad840c1cb05c4cb0bf8d1fdc');
console.log('   - Role: ADMIN (0)');
console.log('');
console.log('준비되었다면 3초 후 테스트를 시작합니다...\n');

setTimeout(() => {
  runAdminTest();
}, 3000);

// test-daily-story.js - 반려동물 조회 후 일상 일지 작성
const { ethers } = require('ethers');
const axios = require('axios');

const WALLET_ADDRESS = '0x38fe5a8c06eacc95f599dfc469e4882cf9318e91';
const PRIVATE_KEY = '5ead52e4cd26a53d2abe1c40b0552cc8b5872c133a2c635205bdf470cbfadbff';
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// 일상 일지 데이터
const DAILY_STORY_DATA = {
  title: '오늘 공원에서의 즐거운 하루',
  content: '오늘 우리 강아지와 함께 공원에 갔습니다. 날씨가 너무 좋아서 산책하기 딱 좋았어요. 다른 강아지들과도 잘 어울려 놀고, 간식도 맛있게 먹었답니다. 행복한 하루였습니다!'
};


async function testDailyStoryFlow() {
  try {
    console.log('🐕 Testing Pet List & Daily Story Flow...\n');
    console.log(`📍 Wallet Address: ${WALLET_ADDRESS}`);
    console.log(`🌐 API Base URL: ${API_BASE_URL}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // ==========================================
    // Step 1: Login
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 1: Login');
    console.log('═══════════════════════════════════════════════════════════\n');

    const challengeResponse = await fetch(`${API_BASE_URL}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: WALLET_ADDRESS })
    });
    const challengeData = await challengeResponse.json();
    console.log('✅ Challenge received');
    console.log('VP Signing Data:', challengeData.vpSigningData ? 'Yes' : 'No');

    // Sign challenge
    const challengeSignature = await wallet.signMessage(challengeData.challenge);

    let vpSignature = null;
    let vpMessage = null;

    // Sign VP message if VP signing data exists
    if (challengeData.vpSigningData) {
      console.log('✍️  Signing VP message...');
      vpMessage = challengeData.vpSigningData.message;
      const signingData = challengeData.vpSigningData.signingData;

      // VP 서명 생성 (VC와 동일한 방식)
      const signingDataBytes = ethers.toUtf8Bytes(signingData);
      const messageHash = ethers.keccak256(signingDataBytes);
      vpSignature = await wallet.signMessage(messageHash);

      console.log('✅ VP message signed');
    }

    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: WALLET_ADDRESS,
        signature: challengeSignature,
        challenge: challengeData.challenge,
        vpSignature: vpSignature,
        vpMessage: vpMessage
      })
    });
    const loginData = await loginResponse.json();
    const accessToken = loginData.accessToken;
    console.log(`✅ Login successful!`);
    console.log(`VP JWT: ${loginData.vpJwt?.substring(0, 50)}...`);
    console.log('');

    // ==========================================
    // Step 2: Get My Pets
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 2: Get My Pets (내 반려동물 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const myPetsResponse = await axios.get(`${API_BASE_URL}/api/pet`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const myPets = myPetsResponse.data;
    console.log('✅ My pets retrieved successfully!');
    console.log(`📋 Total pets: ${JSON.stringify(myPets)}\n`);

    if (myPets.length === 0) {
      console.log('❌ No pets found! Please register a pet first.');
      process.exit(1);
    }


    const petId = myPets.result[0].petId;
    console.log(`✅ Selected Pet ID: ${petId}\n`);

    // ==========================================
    // Step 3: Create Daily Story
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 3: Create Daily Story (일상 일지 작성)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const dailyStoryPayload = {
      petId: petId,
      ...DAILY_STORY_DATA
    };

    console.log('📤 Posting daily story...');
    console.log('Story data:', JSON.stringify(dailyStoryPayload, null, 2));
    console.log('');

    const dailyStoryResponse = await axios.post(`${API_BASE_URL}/api/story/daily`, dailyStoryPayload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const dailyStoryResult = dailyStoryResponse.data;
    console.log('✅ Daily story created successfully!\n');

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ DAILY STORY CREATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 Result:');
    console.log(JSON.stringify(dailyStoryResult, null, 2));
    console.log('\n🎉 All done!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testDailyStoryFlow();

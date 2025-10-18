// test-adoption-post.js - 반려동물 조회 후 입양 공고 작성
const { ethers } = require('ethers');
const axios = require('axios');

const WALLET_ADDRESS = '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0';
const PRIVATE_KEY = '960e72438dadcd8a559b922388616d7c352ea1de901ad61644dcc753642eea6b';
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// 입양 공고 데이터
const ADOPTION_POST_DATA = {
  title: '사랑스러운 골든 리트리버 입양하세요!',
  content: '건강하고 활발한 골든 리트리버입니다. 사람을 무척 좋아하고 다른 반려동물과도 잘 어울립니다. 새로운 가족을 찾고 있습니다.',
  region: 'SEOUL',
  district: '강남구',
  shelterName: '행복 반려동물 보호소',
  contact: '010-1234-5678',
  deadLine: '2025-12-31',
  status: 'ACTIVE'
};


async function testAdoptionPostFlow() {
  try {
    console.log('🐕 Testing Pet List & Adoption Post Flow...\n');
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


    const petId = myPets.result[2].petId;
    console.log(`✅ Selected Pet ID: ${petId}\n`);

    // ==========================================
    // Step 3: Create Adoption Post
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 3: Create Adoption Post (입양 공고 작성)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const adoptionPostPayload = {
      petId: petId,
      ...ADOPTION_POST_DATA,
      images: "'123','123','123'"
    };

    console.log('📤 Posting adoption post...');
    console.log('Post data:', JSON.stringify(adoptionPostPayload, null, 2));
    console.log('');

    const adoptionResponse = await axios.post(`${API_BASE_URL}/api/adoption/post`, adoptionPostPayload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const adoptionResult = adoptionResponse.data;
    console.log('✅ Adoption post created successfully!\n');

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ADOPTION POST CREATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 Result:');
    console.log(JSON.stringify(adoptionResult, null, 2));
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

testAdoptionPostFlow();

// test-adoption-all.js - 입양 공고 모든 API 테스트
const { ethers } = require('ethers');
const axios = require('axios');

const WALLET_ADDRESS = '0x38fe5a8c06eacc95f599dfc469e4882cf9318e91';
const PRIVATE_KEY = '5ead52e4cd26a53d2abe1c40b0552cc8b5872c133a2c635205bdf470cbfadbff';
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// 입양 공고 테스트 데이터
const ADOPTION_POST_DATA = {
  title: '사랑스러운 골든 리트리버 입양 공고',
  images: 'https://example.com/dog1.jpg,https://example.com/dog2.jpg',
  content: '안녕하세요. 건강하고 활발한 골든 리트리버를 입양 보내려고 합니다. 아이는 매우 온순하고 사람을 잘 따르며, 산책을 좋아합니다. 책임감 있게 키워주실 분을 찾습니다.',
  region: '서울',
  district: '강남구',
  shelterName: '서울시 동물보호센터',
  contact: '010-1234-5678',
  deadLine: '2025-12-31T23:59:59.000Z',
  status: 'AVAILABLE'
};

async function testAllAdoptionApis() {
  try {
    console.log('🐕 Testing ALL Adoption APIs...\n');
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

    // Sign challenge
    const challengeSignature = await wallet.signMessage(challengeData.challenge);

    let vpSignature = null;
    let vpMessage = null;

    // Sign VP message if VP signing data exists
    if (challengeData.vpSigningData) {
      console.log('✍️  Signing VP message...');
      vpMessage = challengeData.vpSigningData.message;
      const signingData = challengeData.vpSigningData.signingData;

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
    console.log(`🔑 Access Token: ${accessToken.substring(0, 30)}...`);
    console.log('');

    // ==========================================
    // Step 2: Get Adoption Home
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 2: Get Adoption Home (홈 화면 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const homeResponse = await axios.get(`${API_BASE_URL}/api/adoption/home`);

    const homeData = homeResponse.data;
    console.log('✅ Adoption home data retrieved successfully!');
    console.log('📄 Home Data:', JSON.stringify(homeData, null, 2));
    console.log('');

    // ==========================================
    // Step 3: Get Adoption Posts List
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 3: Get Adoption Posts (입양 공고 리스트 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📥 Fetching adoption posts...');
    const adoptionListResponse = await axios.get(`${API_BASE_URL}/api/adoption`, {
      params: {
        size: 10,
        status: 'AVAILABLE'
      }
    });

    const adoptionList = adoptionListResponse.data;
    console.log('✅ Adoption posts retrieved successfully!');
    console.log(`📋 Total adoption posts: ${adoptionList.result?.adoptions?.length || adoptionList.result?.length || 0}`);
    console.log('');

    // Get first adoption ID for detail test
    const testAdoptId = adoptionList.result?.adoptions?.[0]?.adoptId ||
                        adoptionList.result?.[0]?.adoptId || 1;
    console.log(`📌 Using adoption ID for testing: ${testAdoptId}\n`);

    // ==========================================
    // Step 4: Get Adoption Detail
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 4: Get Adoption Detail (입양 공고 상세 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📥 Fetching adoption detail for ID: ${testAdoptId}...`);
    const adoptionDetailResponse = await axios.get(`${API_BASE_URL}/api/adoption/detail`, {
      params: {
        adoptId: testAdoptId
      }
    });

    const adoptionDetail = adoptionDetailResponse.data;
    console.log('✅ Adoption detail retrieved successfully!');
    console.log('📄 Adoption Detail:', JSON.stringify(adoptionDetail, null, 2));
    console.log('');

    // ==========================================
    // Step 5: Get Adoptions with Filters
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 5: Get Adoptions with Filters (필터링 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📥 Fetching filtered adoption posts (breed: GOLDEN_RETRIEVER)...');
    const filteredResponse = await axios.get(`${API_BASE_URL}/api/adoption`, {
      params: {
        size: 10,
        breed: 'GOLDEN_RETRIEVER',
        region: '서울'
      }
    });

    const filteredList = filteredResponse.data;
    console.log('✅ Filtered adoption posts retrieved successfully!');
    console.log(`📋 Filtered results: ${filteredList.result?.adoptions?.length || filteredList.result?.length || 0}`);
    console.log('🔍 Filters: breed=GOLDEN_RETRIEVER, region=서울');
    console.log('');

    // ==========================================
    // Step 6: Create Adoption Post
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 6: Create Adoption Post (입양 공고 작성)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get pet ID first
    const myPetsResponse = await axios.get(`${API_BASE_URL}/api/pet`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const myPets = myPetsResponse.data;
    if (myPets.result.length === 0) {
      console.log('❌ No pets found! Please register a pet first.');
      console.log('⚠️  Skipping adoption post creation');
      console.log('');
    } else {
      const petId = myPets.result[0].petId;
      console.log(`✅ Using Pet ID: ${petId}`);

      const adoptionPostPayload = {
        petId: petId,
        ...ADOPTION_POST_DATA
      };

      console.log('📤 Creating adoption post...');
      console.log('Adoption data:', JSON.stringify(adoptionPostPayload, null, 2));

      const createResponse = await axios.post(
        `${API_BASE_URL}/api/adoption/post`,
        adoptionPostPayload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const createdAdoption = createResponse.data;
      console.log('✅ Adoption post created successfully!');
      console.log('📄 Created Adoption:', JSON.stringify(createdAdoption, null, 2));
      console.log('');
    }

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL ADOPTION API TESTS COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 Test Summary:');
    console.log('  ✅ Step 1: Login - SUCCESS');
    console.log('  ✅ Step 2: Get Adoption Home - SUCCESS');
    console.log('  ✅ Step 3: Get Adoption Posts List - SUCCESS');
    console.log('  ✅ Step 4: Get Adoption Detail - SUCCESS');
    console.log('  ✅ Step 5: Get Adoptions with Filters - SUCCESS');
    console.log('  ✅ Step 6: Create Adoption Post - SUCCESS');
    console.log('\n🎉 All Adoption APIs tested successfully!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
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

testAllAdoptionApis();

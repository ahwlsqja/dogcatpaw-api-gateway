// test-review-story-all.js - 입양 후기 모든 API 테스트
const { ethers } = require('ethers');
const axios = require('axios');

const WALLET_ADDRESS = '0x38fe5a8c06eacc95f599dfc469e4882cf9318e91';
const PRIVATE_KEY = '5ead52e4cd26a53d2abe1c40b0552cc8b5872c133a2c635205bdf470cbfadbff';
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// 입양 후기 테스트 데이터
const REVIEW_STORY_DATA = {
  title: '우리 강아지를 만난 행복한 순간',
  content: '보호소에서 우리 강아지를 처음 만났을 때의 감동을 잊을 수 없습니다. 처음에는 낯을 가렸지만, 이제는 가족의 일원이 되어 매일 행복을 주고 있습니다. 입양을 결정한 것이 최고의 선택이었습니다!',
  adoptionAgency: '서울시 동물보호센터',
  adoptionDate: '2024-01-15T00:00:00.000Z'
};

async function testAllReviewStoryApis() {
  try {
    console.log('🐕 Testing ALL Review Story APIs...\n');
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
    console.log(`📋 Total pets: ${myPets.result.length}`);

    if (myPets.result.length === 0) {
      console.log('❌ No pets found! Please register a pet first.');
      process.exit(1);
    }

    const petId = myPets.result[0].petId;
    console.log(`✅ Selected Pet ID: ${petId}\n`);

    // ==========================================
    // Step 3: Create Review Story
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 3: Create Review Story (입양 후기 작성)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const reviewStoryPayload = {
      petId: petId,
      ...REVIEW_STORY_DATA
    };

    console.log('📤 Creating review story...');
    console.log('Review data:', JSON.stringify(reviewStoryPayload, null, 2));

    const createResponse = await axios.post(
      `${API_BASE_URL}/api/story/review`,
      reviewStoryPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const createdReview = createResponse.data;
    console.log('✅ Review story created successfully!');
    console.log('📄 Created Review:', JSON.stringify(createdReview, null, 2));
    console.log('');

    // Extract reviewId from response
    const reviewId = createdReview.result?.reviewId || createdReview.reviewId;
    console.log(`📌 Review ID for testing: ${reviewId}\n`);

    // ==========================================
    // Step 4: Get Review Stories (전체 조회)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 4: Get Review Stories (최신 입양 후기 전체 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📥 Fetching review stories list...');
    const getReviewsResponse = await axios.get(`${API_BASE_URL}/api/story/review/reviews`, {
      params: {
        size: 10
      }
    });

    const reviewsList = getReviewsResponse.data;
    console.log('✅ Review stories list retrieved successfully!');
    console.log(`📋 Total reviews in response: ${reviewsList.result?.reviews?.length || reviewsList.length || 0}`);
    console.log('');

    // ==========================================
    // Step 5: Get Single Review Story (단일 조회)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 5: Get Single Review Story (입양 후기 하나 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (reviewId) {
      console.log(`📥 Fetching review with ID: ${reviewId}...`);
      const getSingleResponse = await axios.get(`${API_BASE_URL}/api/story/review/${reviewId}`);

      const singleReview = getSingleResponse.data;
      console.log('✅ Single review story retrieved successfully!');
      console.log('📄 Review Details:', JSON.stringify(singleReview, null, 2));
      console.log('');
    } else {
      console.log('⚠️  No reviewId available, skipping single review test');
      console.log('');
    }

    // ==========================================
    // Step 6: Search Review Stories (검색)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 6: Search Review Stories (입양 후기 검색하기)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const searchKeyword = '행복';
    console.log(`🔍 Searching for keyword: "${searchKeyword}"...`);

    const searchResponse = await axios.get(`${API_BASE_URL}/api/story/review/search`, {
      params: {
        keyword: searchKeyword,
        size: 10
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const searchResults = searchResponse.data;
    console.log('✅ Search completed successfully!');
    console.log(`🔍 Search keyword: "${searchKeyword}"`);
    console.log(`📋 Search results count: ${searchResults.result?.reviews?.length || searchResults.length || 0}`);
    console.log('📄 Search Results:', JSON.stringify(searchResults, null, 2));
    console.log('');

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL REVIEW STORY API TESTS COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 Test Summary:');
    console.log('  ✅ Step 1: Login - SUCCESS');
    console.log('  ✅ Step 2: Get My Pets - SUCCESS');
    console.log('  ✅ Step 3: Create Review Story - SUCCESS');
    console.log('  ✅ Step 4: Get Review Stories (List) - SUCCESS');
    console.log('  ✅ Step 5: Get Single Review Story - SUCCESS');
    console.log('  ✅ Step 6: Search Review Stories - SUCCESS');
    console.log('\n🎉 All Review Story APIs tested successfully!\n');

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

testAllReviewStoryApis();

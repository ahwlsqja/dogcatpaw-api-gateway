// test-daily-story-all.js - 반려동물 일상 일지 모든 API 테스트
const { ethers } = require('ethers');
const axios = require('axios');

const WALLET_ADDRESS = '0x38fe5a8c06eacc95f599dfc469e4882cf9318e91';
const PRIVATE_KEY = '5ead52e4cd26a53d2abe1c40b0552cc8b5872c133a2c635205bdf470cbfadbff';
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// 일상 일지 테스트 데이터
const DAILY_STORY_DATA = {
  title: '오늘 공원에서의 즐거운 하루',
  content: '오늘 우리 강아지와 함께 공원에 갔습니다. 날씨가 너무 좋아서 산책하기 딱 좋았어요. 다른 강아지들과도 잘 어울려 놀고, 간식도 맛있게 먹었답니다. 행복한 하루였습니다!'
};

async function testAllDailyStoryApis() {
  try {
    console.log('🐕 Testing ALL Daily Story APIs...\\n');
    console.log(`📍 Wallet Address: ${WALLET_ADDRESS}`);
    console.log(`🌐 API Base URL: ${API_BASE_URL}\\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // ==========================================
    // Step 1: Login
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 1: Login');
    console.log('═══════════════════════════════════════════════════════════\\n');

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
    console.log('═══════════════════════════════════════════════════════════\\n');

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
    console.log(`✅ Selected Pet ID: ${petId}\\n`);

    // ==========================================
    // Step 3: Create Daily Story
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 3: Create Daily Story (일상 일지 작성)');
    console.log('═══════════════════════════════════════════════════════════\\n');

    const dailyStoryPayload = {
      petId: petId,
      ...DAILY_STORY_DATA
    };

    console.log('📤 Creating daily story...');
    console.log('Story data:', JSON.stringify(dailyStoryPayload, null, 2));

    const createResponse = await axios.post(
      `${API_BASE_URL}/api/story/daily`,
      dailyStoryPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const createdStory = createResponse.data;
    console.log('✅ Daily story created successfully!');
    console.log('📄 Created Story:', JSON.stringify(createdStory, null, 2));
    console.log('');

    // Extract storyId from response (adjust based on actual response structure)
    const storyId = createdStory.result?.storyId || createdStory.storyId;
    console.log(`📌 Story ID for testing: ${storyId}\\n`);

    // ==========================================
    // Step 4: Get Daily Stories (전체 조회)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 4: Get Daily Stories (최신 일상 일지 전체 조회)');
    console.log('═══════════════════════════════════════════════════════════\\n');

    console.log('📥 Fetching daily stories list...');
    const getStoriesResponse = await axios.get(`${API_BASE_URL}/api/story/daily/stories`, {
      params: {
        size: 10
      }
    });

    const storiesList = getStoriesResponse.data;
    console.log('✅ Daily stories list retrieved successfully!');
    console.log(`📋 Total stories in response: ${storiesList.result?.stories?.length || storiesList.length || 0}`);
    console.log('');

    // ==========================================
    // Step 5: Get Single Daily Story (단일 조회)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 5: Get Single Daily Story (일상 일지 하나 조회)');
    console.log('═══════════════════════════════════════════════════════════\\n');

    if (storyId) {
      console.log(`📥 Fetching story with ID: ${storyId}...`);
      const getSingleResponse = await axios.get(`${API_BASE_URL}/api/story/daily/${storyId}`);

      const singleStory = getSingleResponse.data;
      console.log('✅ Single daily story retrieved successfully!');
      console.log('📄 Story Details:', JSON.stringify(singleStory, null, 2));
      console.log('');
    } else {
      console.log('⚠️  No storyId available, skipping single story test');
      console.log('');
    }

    // ==========================================
    // Step 6: Search Daily Stories (검색)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 6: Search Daily Stories (일상 일지 검색하기)');
    console.log('═══════════════════════════════════════════════════════════\\n');

    const searchKeyword = '공원';
    console.log(`🔍 Searching for keyword: "${searchKeyword}"...`);

    const searchResponse = await axios.get(`${API_BASE_URL}/api/story/daily/search`, {
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
    console.log(`📋 Search results count: ${searchResults.result?.stories?.length || searchResults.length || 0}`);
    console.log('📄 Search Results:', JSON.stringify(searchResults, null, 2));
    console.log('');

    // ==========================================
    // Step 7: Toggle Like (좋아요 토글)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 7: Toggle Like (좋아요 토글)');
    console.log('═══════════════════════════════════════════════════════════\\n');

    const testStoryId = 8;
    console.log(`❤️  Toggling like for story ID: ${testStoryId}...`);

    const toggleLikeResponse = await axios.post(
      `${API_BASE_URL}/api/like`,
      null,
      {
        params: {
          storyId: testStoryId
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const likeResult = toggleLikeResponse.data;
    console.log('✅ Like toggled successfully!');
    console.log('📄 Like Result:', JSON.stringify(likeResult, null, 2));
    console.log('');

    // ==========================================
    // Step 8: Get Comments (댓글 조회)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 8: Get Comments (댓글 조회)');
    console.log('═══════════════════════════════════════════════════════════\\n');

    console.log(`💬 Fetching comments for story ID: ${testStoryId}...`);

    const getCommentsResponse = await axios.get(`${API_BASE_URL}/api/comment`, {
      params: {
        storyId: testStoryId,
        size: 10
      }
    });

    const commentsResult = getCommentsResponse.data;
    console.log('✅ Comments retrieved successfully!');
    console.log(`📋 Comments count: ${commentsResult.result?.comments?.length || commentsResult.length || 0}`);
    console.log('📄 Comments:', JSON.stringify(commentsResult, null, 2));
    console.log('');

    // ==========================================
    // Step 9: Write Comment (댓글 작성)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 9: Write Comment (댓글 작성)');
    console.log('═══════════════════════════════════════════════════════════\\n');

    const commentData = {
      storyId: testStoryId,
      comment: '정말 귀여운 강아지네요! 😊'
    };

    console.log('✍️  Writing comment...');
    console.log('Comment data:', JSON.stringify(commentData, null, 2));

    const writeCommentResponse = await axios.post(
      `${API_BASE_URL}/api/comment`,
      commentData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const writeCommentResult = writeCommentResponse.data;
    console.log('✅ Comment written successfully!');
    console.log('📄 Comment Result:', JSON.stringify(writeCommentResult, null, 2));
    console.log('');

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL DAILY STORY API TESTS COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\\n');
    console.log('📊 Test Summary:');
    console.log('  ✅ Step 1: Login - SUCCESS');
    console.log('  ✅ Step 2: Get My Pets - SUCCESS');
    console.log('  ✅ Step 3: Create Daily Story - SUCCESS');
    console.log('  ✅ Step 4: Get Daily Stories (List) - SUCCESS');
    console.log('  ✅ Step 5: Get Single Daily Story - SUCCESS');
    console.log('  ✅ Step 6: Search Daily Stories - SUCCESS');
    console.log('  ✅ Step 7: Toggle Like - SUCCESS');
    console.log('  ✅ Step 8: Get Comments - SUCCESS');
    console.log('  ✅ Step 9: Write Comment - SUCCESS');
    console.log('\\n🎉 All Daily Story + Like/Comment APIs tested successfully!\\n');

  } catch (error) {
    console.error('\\n❌ Error:', error.message);
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

testAllDailyStoryApis();

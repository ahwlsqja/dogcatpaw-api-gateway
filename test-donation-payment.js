// test-donation-payment.js - 후원 및 결제 API 테스트
const { ethers } = require('ethers');
const axios = require('axios');

const WALLET_ADDRESS = '0x38fe5a8c06eacc95f599dfc469e4882cf9318e91';
const PRIVATE_KEY = '5ead52e4cd26a53d2abe1c40b0552cc8b5872c133a2c635205bdf470cbfadbff';
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

async function testDonationAndPaymentApis() {
  try {
    console.log('🦴 Testing Donation & Payment APIs...\n');
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

    const challengeSignature = await wallet.signMessage(challengeData.challenge);

    let vpSignature = null;
    let vpMessage = null;

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
    // Step 2: Get My Bone Balance
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 2: Get My Bone Balance (나의 뼈다귀 잔액 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const boneBalanceResponse = await axios.get(`${API_BASE_URL}/api/donations/bone`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const boneBalance = boneBalanceResponse.data;
    console.log('✅ Bone balance retrieved successfully!');
    console.log('🦴 Bone Balance:', JSON.stringify(boneBalance, null, 2));
    console.log('');

    // ==========================================
    // Step 3: Get Closing Soon Donations
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 3: Get Closing Soon Donations (마감 임박 후원 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const closingResponse = await axios.get(`${API_BASE_URL}/api/donation/closing`);

    const closingDonations = closingResponse.data;
    console.log('✅ Closing soon donations retrieved successfully!');
    console.log('📋 Closing Donations:', JSON.stringify(closingDonations, null, 2));
    console.log('');

    // ==========================================
    // Step 4: Get Donation List
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 4: Get Donation List (전체 후원 리스트 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const donationListResponse = await axios.get(`${API_BASE_URL}/api/donation/list`, {
      params: {
        size: 10,
        status: 'ACTIVE'
      }
    });

    const donationList = donationListResponse.data;
    console.log('✅ Donation list retrieved successfully!');
    console.log(`📋 Total donations: ${donationList.result?.donations?.length || 0}`);
    console.log('');

    // Get first donation ID for detail test
    const testDonationId = donationList.result?.donations?.[0]?.donationId || 1;
    console.log(`📌 Using donation ID for testing: ${testDonationId}\n`);

    // ==========================================
    // Step 5: Get Donation Detail
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 5: Get Donation Detail (후원 상세 정보 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const donationDetailResponse = await axios.get(`${API_BASE_URL}/api/donation`, {
      params: {
        donationId: testDonationId,
        size: 10
      }
    });

    const donationDetail = donationDetailResponse.data;
    console.log('✅ Donation detail retrieved successfully!');
    console.log('📄 Donation Detail:', JSON.stringify(donationDetail, null, 2));
    console.log('');

    // ==========================================
    // Step 6: Get My Donation History
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 6: Get My Donation History (나의 후원 내역 조회)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const myDonationHistoryResponse = await axios.get(`${API_BASE_URL}/api/donations/mine`, {
      params: {
        size: 10
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const myDonationHistory = myDonationHistoryResponse.data;
    console.log('✅ My donation history retrieved successfully!');
    console.log('📋 My Donation History:', JSON.stringify(myDonationHistory, null, 2));
    console.log('');

    // ==========================================
    // Step 7: Prepare Payment (Optional - requires item)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 7: Prepare Payment (결제 준비) - OPTIONAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('⚠️  Skipping payment prepare/approve - requires valid itemId');
    console.log('💡 To test payment flow:');
    console.log('   1. POST /api/payment/prepare with itemId');
    console.log('   2. POST /api/payment/approve with orderId, paymentKey, finalAmount');
    console.log('');

    // Uncomment below to test payment prepare (requires valid itemId)
    /*
    const preparePaymentResponse = await axios.post(
      `${API_BASE_URL}/api/payment/prepare`,
      {
        itemId: 1  // Replace with actual item ID
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const prepareResult = preparePaymentResponse.data;
    console.log('✅ Payment prepared successfully!');
    console.log('📄 Prepare Result:', JSON.stringify(prepareResult, null, 2));
    console.log('');
    */

    // ==========================================
    // Step 8: Create Donation Post (Optional)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 8: Create Donation Post (후원 게시글 작성) - OPTIONAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('⚠️  Skipping donation post creation - requires memberId and petId');
    console.log('💡 To test donation post creation:');
    console.log('   POST /api/donation/posts with full donation data');
    console.log('');

    // Uncomment below to test donation post creation
    /*
    const myPetsResponse = await axios.get(`${API_BASE_URL}/api/pet`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const petId = myPetsResponse.data.result[0].petId;

    const donationPostData = {
      memberId: 1,  // Replace with actual member ID
      petId: petId,
      title: '우리 강아지 치료비 후원 부탁드립니다',
      targetAmount: 1000000,
      deadline: '2025-12-31T23:59:59.000Z',
      category: 'MEDICAL',
      content: '우리 강아지가 아파서 긴급 치료가 필요합니다. 여러분의 따뜻한 후원 부탁드립니다.',
      bankName: '국민은행',
      accountNumber: '123-456-789',
      accountHolder: '홍길동'
    };

    const createDonationResponse = await axios.post(
      `${API_BASE_URL}/api/donation/posts`,
      donationPostData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const createdDonation = createDonationResponse.data;
    console.log('✅ Donation post created successfully!');
    console.log('📄 Created Donation:', JSON.stringify(createdDonation, null, 2));
    console.log('');
    */

    // ==========================================
    // Step 9: Make Donation (Optional)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 9: Make Donation (후원하기) - OPTIONAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('⚠️  Skipping donation - requires memberId, itemId, and donationId');
    console.log('💡 To test donation:');
    console.log('   POST /api/donations with memberId, itemId, donationId');
    console.log('');

    // Uncomment below to test making a donation
    /*
    const makeDonationResponse = await axios.post(
      `${API_BASE_URL}/api/donations`,
      {
        memberId: 1,  // Replace with actual member ID
        itemId: 1,    // Replace with actual item/bone package ID
        donationId: testDonationId
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const donationResult = makeDonationResponse.data;
    console.log('✅ Donation made successfully!');
    console.log('📄 Donation Result:', JSON.stringify(donationResult, null, 2));
    console.log('');
    */

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ DONATION & PAYMENT API TESTS COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 Test Summary:');
    console.log('  ✅ Step 1: Login - SUCCESS');
    console.log('  ✅ Step 2: Get My Bone Balance - SUCCESS');
    console.log('  ✅ Step 3: Get Closing Soon Donations - SUCCESS');
    console.log('  ✅ Step 4: Get Donation List - SUCCESS');
    console.log('  ✅ Step 5: Get Donation Detail - SUCCESS');
    console.log('  ✅ Step 6: Get My Donation History - SUCCESS');
    console.log('  ⚠️  Step 7: Prepare Payment - SKIPPED (Optional)');
    console.log('  ⚠️  Step 8: Create Donation Post - SKIPPED (Optional)');
    console.log('  ⚠️  Step 9: Make Donation - SKIPPED (Optional)');
    console.log('\n🎉 All read-only Donation & Payment APIs tested successfully!\n');
    console.log('💡 Uncomment optional sections to test write operations\n');

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

testDonationAndPaymentApis();

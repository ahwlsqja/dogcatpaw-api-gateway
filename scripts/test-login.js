// test-login.js
const { ethers } = require('ethers');

const WALLET_ADDRESS = '0x7077a0f598ad8a06a46773ed1973a147fffed2e3';
const API_BASE_URL = 'http://localhost:3000';

// 지갑의 개인키를 여기에 입력 (테스트용)
// 명령줄 인자로 받거나 환경 변수에서 가져올 수 있음
const PRIVATE_KEY = process.argv[2] || process.env.TEST_WALLET_PRIVATE_KEY;

async function login() {
  try {
    if (!PRIVATE_KEY) {
      console.error('❌ Error: Private key required!');
      console.log('Usage: node test-login.js <private_key>');
      console.log('   Or: set TEST_WALLET_PRIVATE_KEY environment variable');
      process.exit(1);
    }

    console.log('🔐 Testing Login Flow...\n');
    console.log(`📍 Wallet Address: ${WALLET_ADDRESS}`);
    console.log(`🌐 API Base URL: ${API_BASE_URL}\n`);

    // Step 1: Get Challenge
    console.log('📝 Step 1: Requesting challenge...');
    const challengeResponse = await fetch(`${API_BASE_URL}/api/auth/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: WALLET_ADDRESS
      })
    });

    if (!challengeResponse.ok) {
      throw new Error(`Challenge request failed: ${challengeResponse.status}`);
    }

    const challengeData = await challengeResponse.json();
    console.log('✅ Challenge received:');
    console.log(JSON.stringify(challengeData, null, 2));
    console.log();

    const challenge = challengeData.challenge;

    // Step 2: Sign the challenge
    console.log('✍️  Step 2: Signing challenge with private key...');
    const wallet = new ethers.Wallet(PRIVATE_KEY);

    // Verify wallet address matches
    if (wallet.address.toLowerCase() !== WALLET_ADDRESS.toLowerCase()) {
      throw new Error(`Wallet address mismatch! Expected ${WALLET_ADDRESS}, got ${wallet.address}`);
    }

    const signature = await wallet.signMessage(challenge);
    console.log(`✅ Signature: ${signature}\n`);

    // Step 3: Login with signature
    console.log('🚪 Step 3: Logging in...');
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: WALLET_ADDRESS,
        signature: signature,
        challenge: challenge
      })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`Login failed (${loginResponse.status}): ${errorText}`);
    }

    const loginData = await loginResponse.json();

    // Display results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ LOGIN SUCCESSFUL!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 Login Response:');
    console.log(JSON.stringify(loginData, null, 2));
    console.log();

    if (loginData.accessToken) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🎫 Access Token (copy this):');
      console.log(loginData.accessToken);
      console.log('═══════════════════════════════════════════════════════════');
      console.log();
      console.log('💡 Use this token in your requests:');
      console.log(`curl -H "Authorization: Bearer ${loginData.accessToken}" ${API_BASE_URL}/api/auth/profile`);
    }

    return loginData;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

// Run the login flow
login();

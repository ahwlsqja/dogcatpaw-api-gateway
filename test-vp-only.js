// test-vp-only.js - VP 생성 테스트
const { ethers } = require('ethers');

const WALLET_ADDRESS = '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0';
const PRIVATE_KEY = '960e72438dadcd8a559b922388616d7c352ea1de901ad61644dcc753642eea6b';
const API_BASE_URL = 'http://localhost:3000';

async function testVPOnly() {
  try {
    const provider = new ethers.JsonRpcProvider('http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545');
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Get challenge
    const challengeResponse = await fetch(`${API_BASE_URL}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: WALLET_ADDRESS })
    });
    const challengeData = await challengeResponse.json();

    console.log('Challenge received');
    console.log('Has VP Signing Data:', !!challengeData.vpSigningData);

    // Sign challenge
    const challengeSignature = await wallet.signMessage(challengeData.challenge);

    let vpSignature = null;
    let vpMessage = null;

    if (challengeData.vpSigningData) {
      vpMessage = challengeData.vpSigningData.message;
      const signingData = challengeData.vpSigningData.signingData;

      const signingDataBytes = ethers.toUtf8Bytes(signingData);
      const messageHash = ethers.keccak256(signingDataBytes);
      const sig = wallet.signingKey.sign(messageHash);
      vpSignature = ethers.Signature.from(sig).serialized;

      console.log('\n=== VP Signing ===');
      console.log('Signing Data (first 150 chars):', signingData.substring(0, 150));
      console.log('Message Hash:', messageHash);
      console.log('VP Signature:', vpSignature);
    }

    // Login
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

    console.log('\n=== Login Response ===');
    console.log('Status:', loginResponse.status);
    console.log('Response:', JSON.stringify(loginData, null, 2));

    if (!loginResponse.ok) {
      console.error('\n❌ Login failed!');
      return;
    }

    console.log('\nSuccess:', loginData.success);
    console.log('VP JWT:', loginData.vpJwt);

    if (loginData.vpJwt && loginData.vpJwt !== 'EMPTY') {
      console.log('\n=== Decoding VP JWT ===');
      const parts = loginData.vpJwt.split('.');

      console.log('\nHeader:');
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      console.log(JSON.stringify(header, null, 2));

      console.log('\nPayload:');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      console.log(JSON.stringify(payload, null, 2));

      console.log('\nSignature (hex):');
      const sig = Buffer.from(parts[2], 'base64url').toString('hex');
      console.log('0x' + sig);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testVPOnly();

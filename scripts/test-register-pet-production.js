// test-register-pet-production.js - Production Mode용 (2-Step Flow)
const { ethers } = require('ethers');
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

const WALLET_ADDRESS = '0x7077a0f598ad8a06a46773ed1973a147fffed2e3';
const PRIVATE_KEY = '978f7930143893c1014409a3d5888ee025717c1b5ecd35b89243891646317508';
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

// 펫 정보
const PET_DATA = {
  petName: '멍멍이',
  species: 'dog',
  breed: 'GOLDEN_RETRIEVER',
  old: 3,
  gender: 'MAIL',
  weight: 25.0,
  color: '황금색',
  feature: '활발하고 사교적',
  neutered: true
};

async function registerPetProduction() {
  try {
    console.log('🐕 Testing Pet Registration Flow (Production Mode - 2-Step)...\n');
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
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: WALLET_ADDRESS,
        signature: challengeSignature,
        challenge: challengeData.challenge
      })
    });
    const loginData = await loginResponse.json();
    const accessToken = loginData.accessToken;
    console.log(`✅ Login successful!\n`);

    // ==========================================
    // Step 2: Prepare Registration (get all signing data)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 2: Prepare Registration (get signing data)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const noseImagePath = process.argv[2] || './test-nose-image.jpg';
    if (!fs.existsSync(noseImagePath)) {
      console.error('\n❌ Error: Nose image file not found!');
      console.log('Usage: node test-register-pet-production.js <path_to_nose_image>');
      process.exit(1);
    }
    console.log(`🖼️  Nose image: ${noseImagePath}\n`);

    const formData = new FormData();
    formData.append('noseImage', fs.createReadStream(noseImagePath));
    formData.append('petName', PET_DATA.petName);
    formData.append('species', PET_DATA.species);
    formData.append('breed', PET_DATA.breed);
    formData.append('old', PET_DATA.old.toString());
    formData.append('gender', PET_DATA.gender);
    formData.append('weight', PET_DATA.weight.toString());
    formData.append('color', PET_DATA.color);
    formData.append('feature', PET_DATA.feature);
    formData.append('neutered', PET_DATA.neutered.toString());

    console.log('📤 Calling /pet/prepare-registration...');
    const prepareResponse = await axios.post(`${API_BASE_URL}/pet/prepare-registration`, formData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const prepareData = prepareResponse.data;
    const petDID = prepareData.petDID;

    console.log(`✅ Signing data prepared!`);
    console.log(`🐾 Pet DID: ${petDID}\n`);

    // ==========================================
    // Step 3: Sign all three transactions
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 3: Sign all three transactions');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 3a. Sign Pet Registration Transaction
    console.log('✍️  Signing Pet Registration transaction...');
    const petTxData = prepareData.petRegistrationTxData;
    const nonce = await provider.getTransactionCount(wallet.address);

    const petTx = {
      to: petTxData.to,
      data: petTxData.data,
      gasLimit: ethers.toBeHex(3000000),
      gasPrice: ethers.toBeHex(0),
      value: petTxData.value || 0,
      nonce: nonce,
      chainId: 1337
    };

    const petSignedTx = await wallet.signTransaction(petTx);
    console.log(`✅ Pet Registration signed`);

    // 3b. Sign Guardian Link Transaction
    console.log('✍️  Signing Guardian Link transaction...');
    const guardianLinkTxData = prepareData.guardianLinkTxData;
    const linkNonce = await provider.getTransactionCount(wallet.address);

    const linkTx = {
      to: guardianLinkTxData.to,
      data: guardianLinkTxData.data,
      gasLimit: ethers.toBeHex(3000000),
      gasPrice: ethers.toBeHex(0),
      value: guardianLinkTxData.value || 0,
      nonce: linkNonce + 1, // Next nonce (after pet registration)
      chainId: 1337
    };

    const guardianLinkSignedTx = await wallet.signTransaction(linkTx);
    console.log(`✅ Guardian Link signed`);

    // 3c. Sign VC Message
    console.log('✍️  Signing VC message...');
    const vcSigningData = prepareData.vcSigningData;
    const vcMessage = vcSigningData.message;
    const vcSignature = await wallet.signMessage(vcSigningData.messageHash);
    console.log(`✅ VC message signed\n`);

    // ==========================================
    // Step 4: Submit all signatures to /pet/register
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 4: Submit all signatures');
    console.log('═══════════════════════════════════════════════════════════\n');

    const registerFormData = new FormData();
    registerFormData.append('noseImage', fs.createReadStream(noseImagePath));
    registerFormData.append('petName', PET_DATA.petName);
    registerFormData.append('species', PET_DATA.species);
    registerFormData.append('breed', PET_DATA.breed);
    registerFormData.append('old', PET_DATA.old.toString());
    registerFormData.append('gender', PET_DATA.gender);
    registerFormData.append('weight', PET_DATA.weight.toString());
    registerFormData.append('color', PET_DATA.color);
    registerFormData.append('feature', PET_DATA.feature);
    registerFormData.append('neutered', PET_DATA.neutered.toString());

    // 세 개의 서명 추가
    registerFormData.append('signedTx', petSignedTx);
    registerFormData.append('guardianLinkSignedTx', guardianLinkSignedTx);
    registerFormData.append('vcSignature', vcSignature);
    registerFormData.append('vcMessage', JSON.stringify(vcMessage));

    console.log('📤 Submitting all signatures to /pet/register...');
    const registerResponse = await axios.post(`${API_BASE_URL}/pet/register`, registerFormData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...registerFormData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const registerData = registerResponse.data;
    console.log('✅ All signatures submitted!\n');

    // ==========================================
    // Final Summary
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ PET REGISTRATION COMPLETE (Production Mode)');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`🐾 Pet DID: ${registerData.petDID}`);
    console.log(`📝 Transaction Hash: ${registerData.txHash}`);
    console.log(`📦 Block Number: ${registerData.blockNumber}`);
    console.log(`\n📋 Background Jobs:`);
    console.log(`   🔗 Guardian Link: ${registerData.jobs.guardianLink}`);
    console.log(`   📜 VC Creation: ${registerData.jobs.vc}`);
    console.log(`   🌱 Spring Sync: ${registerData.jobs.spring}`);
    console.log(`\n💡 Background jobs are processing. Check logs for status.\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

registerPetProduction();

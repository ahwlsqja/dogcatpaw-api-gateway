// test-register-pet.js
const { ethers } = require('ethers');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const WALLET_ADDRESS = '0x7077a0f598ad8a06a46773ed1973a147fffed2e3';
const PRIVATE_KEY = '978f7930143893c1014409a3d5888ee025717c1b5ecd35b89243891646317508';
const API_BASE_URL = 'http://localhost:3000';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545'; // Besu RPC endpoint

// 펫 정보
const PET_DATA = {
  petName: '다',
  species: 'dog',
  breed: 'GOLDEN_RETRIEVER',
  old: 2,
  gender: 'MAIL',
  weight: 20.5,
  color: '황금색',
  feature: '온순하고 사람을 좋아함',
  neutered: true
};

async function registerPet() {
  try {
    console.log('🐕 Testing Pet Registration Flow...\n');
    console.log(`📍 Wallet Address: ${WALLET_ADDRESS}`);
    console.log(`🌐 API Base URL: ${API_BASE_URL}\n`);

    // ==========================================
    // Step 1: Login to get access token
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 1: Login to get access token');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1a. Get Challenge
    console.log('📝 Step 1a: Requesting challenge...');
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
    console.log('✅ Challenge received:', challengeData.challenge);

    // 1b. Sign the challenge
    console.log('✍️  Step 1b: Signing challenge...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const challengeSignature = await wallet.signMessage(challengeData.challenge);
    console.log(`✅ Challenge Signature: ${challengeSignature.substring(0, 20)}...\n`);

    // 1c. Login with signature
    console.log('🚪 Step 1c: Logging in...');
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: WALLET_ADDRESS,
        signature: challengeSignature,
        challenge: challengeData.challenge
      })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`Login failed (${loginResponse.status}): ${errorText}`);
    }

    const loginData = await loginResponse.json();
    const accessToken = loginData.accessToken;
    console.log('✅ Login successful!');
    console.log(`🎫 Access Token: ${accessToken.substring(0, 30)}...\n`);

    // ==========================================
    // Step 2: Prepare Pet Registration (get VC signing data)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 2: Prepare Pet Registration (get VC signing data)');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 Pet Data:');
    console.log(JSON.stringify(PET_DATA, null, 2));
    console.log();

    const prepareResponse = await fetch(`${API_BASE_URL}/pet/prepare-registration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(PET_DATA)
    });

    if (!prepareResponse.ok) {
      const errorText = await prepareResponse.text();
      throw new Error(`Prepare registration failed (${prepareResponse.status}): ${errorText}`);
    }

    const prepareData = await prepareResponse.json();
    console.log('✅ VC Signing Data received:');
    console.log(`   messageHash: ${prepareData.vcSigningData.messageHash}`);
    console.log('✅ Guardian Link Transaction Data received:');
    console.log(`   to: ${prepareData.guardianLinkTxData.to}`);
    console.log(`   instruction: ${prepareData.vcSigningData.instruction}\n`);

    // Store the original message for later verification
    const vcMessage = prepareData.vcSigningData.message;

    // ==========================================
    // Step 3: Sign VC Message
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 3: Sign VC Message');
    console.log('═══════════════════════════════════════════════════════════\n');

    const vcSignature = await wallet.signMessage(prepareData.vcSigningData.messageHash);
    console.log(`✅ VC Signature: ${vcSignature}\n`);

    // ==========================================
    // Step 4: Register Pet (with nose image + vcSignature)
    // ==========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Step 4: Register Pet (with nose image + vcSignature)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Check if nose image file exists
    const noseImagePath = process.argv[2] || './test-nose-image.jpg';
    console.log(`🖼️  Looking for nose image: ${noseImagePath}`);

    if (!fs.existsSync(noseImagePath)) {
      console.error('\n❌ Error: Nose image file not found!');
      console.log('Usage: node test-register-pet.js <path_to_nose_image>');
      console.log('Example: node test-register-pet.js ./dog-nose.jpg');
      console.log('\n💡 Tip: You need to provide a dog/cat nose photo for registration.');
      process.exit(1);
    }

    console.log(`✅ Nose image found: ${noseImagePath}`);
    console.log(`   File size: ${fs.statSync(noseImagePath).size} bytes\n`);

    // Create FormData
    const formData = new FormData();

    // Add nose image
    formData.append('noseImage', fs.createReadStream(noseImagePath));

    // Add pet data
    formData.append('petName', PET_DATA.petName);
    formData.append('species', PET_DATA.species);
    formData.append('breed', PET_DATA.breed);
    formData.append('old', PET_DATA.old.toString());
    formData.append('gender', PET_DATA.gender);
    formData.append('weight', PET_DATA.weight.toString());
    formData.append('color', PET_DATA.color);
    formData.append('feature', PET_DATA.feature);
    formData.append('neutered', PET_DATA.neutered.toString());

    // Add VC signature and message
    formData.append('vcSignature', vcSignature);
    formData.append('vcMessage', JSON.stringify(vcMessage));

    console.log('📤 Sending pet registration request...');
    const registerResponse = await axios.post(`${API_BASE_URL}/pet/register`, formData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const registerData = registerResponse.data;

    // Check if transaction signing is required
    if (registerData.requiresSignature && registerData.transactionData) {
      // ==========================================
      // Step 5: Sign and Send Transaction
      // ==========================================
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📝 Step 5: Sign and Send Blockchain Transaction');
      console.log('═══════════════════════════════════════════════════════════\n');

      const txData = registerData.transactionData;
      console.log('🔐 Signing transaction...');
      console.log(`   To: ${txData.to}`);
      console.log(`   From: ${txData.from}`);

      // Get current nonce from provider
      const nonce = await provider.getTransactionCount(wallet.address);
      console.log(`   Nonce: ${nonce}`);

      // Sign the transaction
      const tx = {
        to: txData.to,
        data: txData.data,
        gasLimit: txData.gasLimit || ethers.toBeHex(3000000),
        gasPrice: txData.gasPrice || ethers.toBeHex(0),
        value: txData.value || 0,
        nonce: nonce,
        chainId: 1337 // Besu private network
      };

      const signedTx = await wallet.signTransaction(tx);
      console.log(`✅ Transaction signed: ${signedTx.substring(0, 40)}...\n`);

      // ==========================================
      // Step 6: Send Signed Transaction to Server
      // ==========================================
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📝 Step 6: Send Signed Transaction');
      console.log('═══════════════════════════════════════════════════════════\n');

      // Create new FormData with signedTx
      const formData2 = new FormData();
      formData2.append('noseImage', fs.createReadStream(noseImagePath));
      formData2.append('petName', PET_DATA.petName);
      formData2.append('species', PET_DATA.species);
      formData2.append('breed', PET_DATA.breed);
      formData2.append('old', PET_DATA.old.toString());
      formData2.append('gender', PET_DATA.gender);
      formData2.append('weight', PET_DATA.weight.toString());
      formData2.append('color', PET_DATA.color);
      formData2.append('feature', PET_DATA.feature);
      formData2.append('neutered', PET_DATA.neutered.toString());
      formData2.append('vcSignature', vcSignature);
      formData2.append('vcMessage', JSON.stringify(vcMessage));
      formData2.append('signedTx', signedTx);

      console.log('📤 Sending signed transaction...');
      const finalResponse = await axios.post(`${API_BASE_URL}/pet/register`, formData2, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...formData2.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      const finalData = finalResponse.data;
      console.log('✅ Transaction submitted to blockchain!\n');

      // ==========================================
      // Step 7: Display Final Results
      // ==========================================
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ PET REGISTRATION SUCCESSFUL!');
      console.log('═══════════════════════════════════════════════════════════\n');

      console.log('📊 Final Registration Response:');
      console.log(JSON.stringify(finalData, null, 2));
      console.log();

      if (finalData.petDID) {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🐾 Pet DID (copy this):');
        console.log(finalData.petDID);
        console.log('═══════════════════════════════════════════════════════════');
        console.log();
        console.log('💡 VC is being created in the background...');
        console.log('   Check VC status after a few seconds:');
        console.log(`   curl -H "Authorization: Bearer ${accessToken}" ${API_BASE_URL}/vc/pet/${finalData.petDID}`);
        console.log();
        console.log('💡 View pet profile:');
        console.log(`   curl -H "Authorization: Bearer ${accessToken}" ${API_BASE_URL}/api/auth/profile`);
        console.log();
        console.log('⚠️  Note: Guardian Link is processed in background queue (no user signature yet)');
        console.log('   For production, frontend should:');
        console.log('   1. Extract feature vector from nose image client-side');
        console.log('   2. Calculate petDID from feature vector');
        console.log('   3. Build and sign Guardian Link transaction');
        console.log('   4. Submit guardianLinkSignedTx with Pet registration');
      }

      return finalData;
    }

    // If no signature required (development mode)
    // ==========================================
    // Display Results
    // ==========================================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ PET REGISTRATION SUCCESSFUL!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 Registration Response:');
    console.log(JSON.stringify(registerData, null, 2));
    console.log();

    if (registerData.petDID) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🐾 Pet DID (copy this):');
      console.log(registerData.petDID);
      console.log('═══════════════════════════════════════════════════════════');
      console.log();
      console.log('💡 VC is being created in the background...');
      console.log('   Check VC status after a few seconds:');
      console.log(`   curl -H "Authorization: Bearer ${accessToken}" ${API_BASE_URL}/vc/pet/${registerData.petDID}`);
      console.log();
      console.log('💡 View pet profile:');
      console.log(`   curl -H "Authorization: Bearer ${accessToken}" ${API_BASE_URL}/api/auth/profile`);
    }

    return registerData;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

// Run the pet registration flow
registerPet();

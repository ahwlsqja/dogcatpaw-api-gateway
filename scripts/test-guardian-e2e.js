// scripts/test-guardian-e2e.js
const axios = require('axios');
const { generateToken } = require('./generate-web3-token');
const readline = require('readline');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const USE_DEV_MODE = process.env.USE_DEV_MODE === 'true';

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}[STEP ${step}] ${message}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
}

function logResponse(response) {
  console.log(colors.gray + JSON.stringify(response.data, null, 2) + colors.reset);
}

function logError(error) {
  if (error.response) {
    console.log(colors.red + JSON.stringify(error.response.data, null, 2) + colors.reset);
  } else {
    console.log(colors.red + error.message + colors.reset);
  }
}

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function testGuardianE2E() {
  console.log('\n' + colors.blue + '🐕 PetDID Guardian E2E Test' + colors.reset);
  console.log(colors.gray + `API Base: ${API_BASE}` + colors.reset);
  console.log(colors.gray + `Dev Mode: ${USE_DEV_MODE ? 'YES' : 'NO'}` + colors.reset);
  console.log();

  let wallet, token, headers;

  // ========================
  // STEP 0: Setup Auth
  // ========================
  logStep(0, 'Setup Authentication');

  if (USE_DEV_MODE) {
    log('🔧', 'Using DEV MODE - no Web3 token needed', colors.yellow);
    headers = {
      walletaddress: '0xc9a1f7d54e24ca7a5197126fb0d0310cc593e6cc',
    };
    wallet = {
      address: '0xc9a1f7d54e24ca7a5197126fb0d0310cc593e6cc',
      privateKey: 'dev-mode-no-private-key',
    };
  } else {
    log('🔐', 'Generating Web3 wallet and token...', colors.green);
    const auth = await generateToken();
    wallet = auth.wallet;
    token = auth.token;
    headers = {
      authorization: token,
      walletaddress: wallet.address.toLowerCase(),
    };
    log('✅', `Wallet: ${wallet.address}`, colors.green);
  }

  // ========================
  // STEP 1: Email Verification
  // ========================
  logStep(1, 'Email Verification (Prerequisite)');

  const testEmail = `test-${Date.now()}@example.com`;
  log('📧', `Sending verification code to: ${testEmail}`, colors.blue);

  try {
    const sendCodeRes = await axios.post(
      `${API_BASE}/email/send-code`,
      { email: testEmail },
      { headers }
    );
    logResponse(sendCodeRes);
    log('✅', 'Verification code sent! Check your email or logs.', colors.green);
  } catch (error) {
    log('❌', 'Failed to send code', colors.red);
    logError(error);
    return;
  }

  // Wait for user to check email
  const verificationCode = await askQuestion('\n📮 Enter the 6-digit verification code: ');

  try {
    const verifyRes = await axios.post(
      `${API_BASE}/email/verify-code`,
      { code: verificationCode },
      { headers }
    );
    logResponse(verifyRes);

    if (!verifyRes.data.success) {
      log('❌', 'Email verification failed!', colors.red);
      return;
    }

    log('✅', 'Email verified successfully!', colors.green);
  } catch (error) {
    log('❌', 'Failed to verify code', colors.red);
    logError(error);
    return;
  }

  // ========================
  // STEP 2: Check Registration Status
  // ========================
  logStep(2, 'Check Guardian Registration Status');

  try {
    const checkRes = await axios.get(
      `${API_BASE}/api/guardian/check/${wallet.address.toLowerCase()}`,
      { headers }
    );
    logResponse(checkRes);

    if (checkRes.data.isRegistered) {
      log('⚠️', 'Guardian already registered! Skipping registration.', colors.yellow);
    }
  } catch (error) {
    log('❌', 'Failed to check registration', colors.red);
    logError(error);
  }

  // ========================
  // STEP 3: Register Guardian
  // ========================
  logStep(3, 'Register Guardian');

  const guardianData = {
    email: testEmail,
    name: 'Test Guardian',
    phone: '+82-10-1234-5678',
    verificationMethod: 2, // Email verified
    // signedTx: 'not needed in dev',
  };

  log('📝', 'Registering guardian with data:', colors.blue);
  console.log(colors.gray + JSON.stringify(guardianData, null, 2) + colors.reset);

  try {
    const registerRes = await axios.post(
      `${API_BASE}/api/guardian/register`,
      guardianData,
      { headers }
    );
    logResponse(registerRes);

    if (registerRes.data.success) {
      log('✅', `Guardian registered! TX Hash: ${registerRes.data.txHash || 'N/A'}`, colors.green);
    } else {
      log('⚠️', `Registration issue: ${registerRes.data.error || 'Unknown'}`, colors.yellow);
    }
  } catch (error) {
    log('❌', 'Failed to register guardian', colors.red);
    logError(error);
  }

  // ========================
  // STEP 4: Get Guardian Profile
  // ========================
  logStep(4, 'Get Guardian Profile');

  try {
    const profileRes = await axios.get(
      `${API_BASE}/api/guardian/profile/${wallet.address.toLowerCase()}`,
      { headers }
    );
    logResponse(profileRes);
    log('✅', 'Profile fetched successfully!', colors.green);
  } catch (error) {
    log('❌', 'Failed to get profile', colors.red);
    logError(error);
  }

  // ========================
  // STEP 5: Get Verification Status
  // ========================
  logStep(5, 'Get Verification Status');

  try {
    const verificationRes = await axios.get(
      `${API_BASE}/api/guardian/verification/${wallet.address.toLowerCase()}`,
      { headers }
    );
    logResponse(verificationRes);
    log('✅', 'Verification status fetched!', colors.green);
  } catch (error) {
    log('❌', 'Failed to get verification', colors.red);
    logError(error);
  }

  // ========================
  // STEP 6: Get Guardian's Pets
  // ========================
  logStep(6, 'Get Guardian Pets');

  try {
    const petsRes = await axios.get(
      `${API_BASE}/api/guardian/pets/${wallet.address.toLowerCase()}`,
      { headers }
    );
    logResponse(petsRes);
    log('✅', 'Pets list fetched!', colors.green);
  } catch (error) {
    log('❌', 'Failed to get pets', colors.red);
    logError(error);
  }

  // ========================
  // STEP 7: Get Total Guardians
  // ========================
  logStep(7, 'Get Total Guardians Count');

  try {
    const totalRes = await axios.get(`${API_BASE}/api/guardian/total`, { headers });
    logResponse(totalRes);
    log('✅', `Total guardians: ${totalRes.data.total}`, colors.green);
  } catch (error) {
    log('❌', 'Failed to get total', colors.red);
    logError(error);
  }

  // ========================
  // OPTIONAL: Link Pet (if you have a pet DID)
  // ========================
  const linkPet = await askQuestion('\n🐶 Do you want to link a pet? (y/N): ');

  if (linkPet.toLowerCase() === 'y') {
    const petDID = await askQuestion('Enter Pet DID: ');

    logStep(8, 'Link Pet to Guardian');

    try {
      const linkRes = await axios.post(
        `${API_BASE}/api/guardian/link-pet`,
        { petDID },
        { headers }
      );
      logResponse(linkRes);
      log('✅', 'Pet linked successfully!', colors.green);
    } catch (error) {
      log('❌', 'Failed to link pet', colors.red);
      logError(error);
    }
  }

  // ========================
  // Summary
  // ========================
  console.log('\n' + colors.blue + '='.repeat(60) + colors.reset);
  console.log(colors.green + '✅ E2E Test Completed!' + colors.reset);
  console.log(colors.blue + '='.repeat(60) + colors.reset);
  console.log(colors.gray + `Wallet Address: ${wallet.address}` + colors.reset);
  console.log(colors.gray + `Email: ${testEmail}` + colors.reset);
  console.log();
}

// Run test
testGuardianE2E().catch((error) => {
  console.error(colors.red + '💥 Test failed:', error.message + colors.reset);
  process.exit(1);
});

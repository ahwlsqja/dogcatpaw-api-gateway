// grant-model-server-role.js
const { ethers } = require('ethers');

// 환경 변수 설정
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';
const PET_DID_REGISTRY_ADDRESS = '0xBF921f94Fd9eF1738bE25D8CeCFDFE2C822c81B0';
const ADMIN_PRIVATE_KEY = '0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63';

// PetDIDRegistry ABI
const PET_DID_REGISTRY_ABI = [
  "function grantRole(bytes32 role, address account)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function MODEL_SERVER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)"
];

async function grantModelServerRole() {
  try {
    console.log('🎁 Granting MODEL_SERVER_ROLE to Admin...\n');

    // 1. Provider 및 Wallet 연결
    console.log(`📡 Connecting to RPC: ${RPC_URL}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const adminAddress = wallet.address;

    console.log(`✅ Connected! Admin Address: ${adminAddress}\n`);

    // 2. 컨트랙트 연결 (Signer와 함께)
    console.log(`📜 PetDIDRegistry Contract: ${PET_DID_REGISTRY_ADDRESS}`);
    const contract = new ethers.Contract(
      PET_DID_REGISTRY_ADDRESS,
      PET_DID_REGISTRY_ABI,
      wallet  // ← Signer 사용 (트랜잭션 전송 가능)
    );

    // 3. MODEL_SERVER_ROLE 값 가져오기
    const MODEL_SERVER_ROLE = await contract.MODEL_SERVER_ROLE();
    console.log(`🎭 MODEL_SERVER_ROLE: ${MODEL_SERVER_ROLE}\n`);

    // 4. 현재 상태 확인
    const hasRoleBefore = await contract.hasRole(MODEL_SERVER_ROLE, adminAddress);
    console.log(`📊 Current Status: ${hasRoleBefore ? '✅ Already has role' : '❌ Does not have role'}\n`);

    if (hasRoleBefore) {
      console.log('✅ Admin already has MODEL_SERVER_ROLE. Nothing to do!');
      return;
    }

    // 5. MODEL_SERVER_ROLE 부여
    console.log('⏳ Sending grantRole transaction...');
    const tx = await contract.grantRole(MODEL_SERVER_ROLE, adminAddress, {
      gasLimit: 100000
    });

    console.log(`📤 Transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed! Block: ${receipt.blockNumber}\n`);

    // 6. 결과 확인
    const hasRoleAfter = await contract.hasRole(MODEL_SERVER_ROLE, adminAddress);
    console.log('📊 Final Status:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Admin Address: ${adminAddress}`);
    console.log(`MODEL_SERVER_ROLE: ${hasRoleAfter ? '✅ Granted' : '❌ Failed'}`);
    console.log(`Transaction Hash: ${tx.hash}`);
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log('═══════════════════════════════════════════════════════════');

    if (hasRoleAfter) {
      console.log('\n🎉 SUCCESS! Admin can now sign biometric verification transactions!');
    } else {
      console.log('\n❌ ERROR: Role grant failed!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'NETWORK_ERROR') {
      console.error('   → Check if RPC URL is accessible');
    } else if (error.code === 'CALL_EXCEPTION') {
      console.error('   → Check if admin has DEFAULT_ADMIN_ROLE');
    } else if (error.reason) {
      console.error(`   → Reason: ${error.reason}`);
    }
  }
}

grantModelServerRole();

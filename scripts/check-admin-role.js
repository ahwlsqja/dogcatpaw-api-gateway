// check-admin-role.js
const { ethers } = require('ethers');

// 환경 변수 설정
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';
const PET_DID_REGISTRY_ADDRESS = '0xBF921f94Fd9eF1738bE25D8CeCFDFE2C822c81B0';
const ADMIN_PRIVATE_KEY = '0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63';

// PetDIDRegistry ABI (hasRole, MODEL_SERVER_ROLE만 필요)
const PET_DID_REGISTRY_ABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function MODEL_SERVER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)"
];

async function checkAdminRole() {
  try {
    console.log('🔍 Checking Admin Role on Blockchain...\n');

    // 1. Provider 연결
    console.log(`📡 Connecting to RPC: ${RPC_URL}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 블록 번호로 연결 확인
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected! Current block: ${blockNumber}\n`);

    // 2. Private Key로부터 주소 도출
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const adminAddress = wallet.address;
    console.log(`🔑 Admin Private Key: ${ADMIN_PRIVATE_KEY}`);
    console.log(`📍 Admin Address: ${adminAddress}\n`);

    // 3. 컨트랙트 연결
    console.log(`📜 PetDIDRegistry Contract: ${PET_DID_REGISTRY_ADDRESS}`);
    const contract = new ethers.Contract(
      PET_DID_REGISTRY_ADDRESS,
      PET_DID_REGISTRY_ABI,
      provider
    );

    // 4. MODEL_SERVER_ROLE 값 가져오기
    const MODEL_SERVER_ROLE = await contract.MODEL_SERVER_ROLE();
    console.log(`🎭 MODEL_SERVER_ROLE: ${MODEL_SERVER_ROLE}\n`);

    // 5. DEFAULT_ADMIN_ROLE 값 가져오기
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    console.log(`🎭 DEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}\n`);

    // 6. 어드민 주소가 MODEL_SERVER_ROLE을 가지고 있는지 확인
    const hasModelServerRole = await contract.hasRole(MODEL_SERVER_ROLE, adminAddress);
    console.log(`✨ Has MODEL_SERVER_ROLE: ${hasModelServerRole ? '✅ YES' : '❌ NO'}`);

    // 7. 어드민 주소가 DEFAULT_ADMIN_ROLE을 가지고 있는지 확인
    const hasDefaultAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);
    console.log(`✨ Has DEFAULT_ADMIN_ROLE: ${hasDefaultAdminRole ? '✅ YES' : '❌ NO'}\n`);

    // 8. 결과 요약
    console.log('📊 Summary:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Admin Address: ${adminAddress}`);
    console.log(`MODEL_SERVER_ROLE: ${hasModelServerRole ? '✅ Granted' : '❌ Not Granted'}`);
    console.log(`DEFAULT_ADMIN_ROLE: ${hasDefaultAdminRole ? '✅ Granted' : '❌ Not Granted'}`);

    if (hasModelServerRole) {
      console.log('\n✅ SUCCESS: Admin can sign biometric verification transactions!');
    } else {
      console.log('\n❌ ERROR: Admin does NOT have MODEL_SERVER_ROLE!');
      console.log('   You need to grant this role on the blockchain.');
    }
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'NETWORK_ERROR') {
      console.error('   → Check if RPC URL is accessible');
    } else if (error.code === 'CALL_EXCEPTION') {
      console.error('   → Check if contract address is correct');
    }
  }
}

checkAdminRole();

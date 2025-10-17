// check-guardian-admin.js
const { ethers } = require('ethers');

// 환경 변수 설정
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';
const GUARDIAN_REGISTRY_ADDRESS = '0xBeC8a9e485a4B75d3b14249de7CA6D124fE94795';
const ADMIN_PRIVATE_KEY = '0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63';

// GuardianRegistry ABI
const GUARDIAN_REGISTRY_ABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function VERIFIER_ROLE() view returns (bytes32)",
  "function linkPet(string petDID)",
  "function unlinkPet(string petDID)"
];

async function checkGuardianAdmin() {
  try {
    console.log('🔍 Checking Admin Role on GuardianRegistry...\n');

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
    console.log(`📜 GuardianRegistry Contract: ${GUARDIAN_REGISTRY_ADDRESS}`);
    const contract = new ethers.Contract(
      GUARDIAN_REGISTRY_ADDRESS,
      GUARDIAN_REGISTRY_ABI,
      provider
    );

    // 4. Role 값들 가져오기
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    console.log(`🎭 DEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}`);

    const VERIFIER_ROLE = await contract.VERIFIER_ROLE();
    console.log(`🎭 VERIFIER_ROLE: ${VERIFIER_ROLE}\n`);

    // 5. Admin이 가진 role 확인
    const hasDefaultAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);
    console.log(`✨ Has DEFAULT_ADMIN_ROLE: ${hasDefaultAdminRole ? '✅ YES' : '❌ NO'}`);

    const hasVerifierRole = await contract.hasRole(VERIFIER_ROLE, adminAddress);
    console.log(`✨ Has VERIFIER_ROLE: ${hasVerifierRole ? '✅ YES' : '❌ NO'}\n`);

    // 6. 결과 요약
    console.log('📊 Summary:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Admin Address: ${adminAddress}`);
    console.log(`DEFAULT_ADMIN_ROLE: ${hasDefaultAdminRole ? '✅ Granted' : '❌ Not Granted'}`);
    console.log(`VERIFIER_ROLE: ${hasVerifierRole ? '✅ Granted' : '❌ Not Granted'}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // 7. linkPet/unlinkPet 권한 확인
    console.log('🔐 Permission Analysis:');
    if (hasDefaultAdminRole) {
      console.log('✅ Admin can call linkPet() and unlinkPet()');
      console.log('   → DEFAULT_ADMIN_ROLE allows all operations');
    } else {
      console.log('❌ Admin CANNOT call linkPet() and unlinkPet()');
      console.log('   → Missing DEFAULT_ADMIN_ROLE');
      console.log('   → GuardianRegistry operations will fail!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'NETWORK_ERROR') {
      console.error('   → Check if RPC URL is accessible');
    } else if (error.code === 'CALL_EXCEPTION') {
      console.error('   → Check if contract address is correct');
    }
  }
}

checkGuardianAdmin();

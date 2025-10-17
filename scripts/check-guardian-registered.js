// check-guardian-registered.js
const { ethers } = require('ethers');

const WALLET_ADDRESS = '0x7077a0F598aD8A06A46773ED1973a147FFfeD2E3';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';
const GUARDIAN_REGISTRY_ADDRESS = '0xBeC8a9e485a4B75d3b14249de7CA6D124fE94795';

const GUARDIAN_REGISTRY_ABI = [
  "function getGuardianProfile(address guardianAddress) view returns (tuple(address guardianAddress, bytes32 personalDataHash, string ncpStorageURI, uint8 verificationMethod, uint8 verificationLevel, uint48 registeredAt, uint48 lastUpdated, bool isActive) profile)"
];

async function checkGuardianRegistered() {
  try {
    console.log('🔍 Checking Guardian Registration Status...\n');
    console.log(`Guardian Address: ${WALLET_ADDRESS}\n`);

    // Connect to provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected to blockchain (block ${blockNumber})\n`);

    // Connect to contract
    const contract = new ethers.Contract(
      GUARDIAN_REGISTRY_ADDRESS,
      GUARDIAN_REGISTRY_ABI,
      provider
    );

    // Try to get profile (will revert if not registered)
    try {
      const profile = await contract.getGuardianProfile(WALLET_ADDRESS);
      const isRegistered = profile.isActive;
      console.log(`Registration Status: ${isRegistered ? '✅ REGISTERED' : '❌ NOT ACTIVE'}\n`);
      console.log('📊 Guardian Profile:');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Address: ${profile.guardianAddress}`);
      console.log(`Personal Data Hash: ${profile.personalDataHash}`);
      console.log(`Storage URI: ${profile.ncpStorageURI}`);
      console.log(`Verification Method: ${profile.verificationMethod}`);
      console.log(`Verification Level: ${profile.verificationLevel}`);
      console.log(`Registered At: ${new Date(Number(profile.registeredAt) * 1000).toISOString()}`);
      console.log(`Last Updated: ${new Date(Number(profile.lastUpdated) * 1000).toISOString()}`);
      console.log(`Is Active: ${profile.isActive ? '✅' : '❌'}`);
      console.log('═══════════════════════════════════════════════════════════\n');
    } catch (profileError) {
      console.log('❌ Registration Status: NOT REGISTERED\n');
      console.log('⚠️  Guardian is NOT registered in GuardianRegistry!');
      console.log('');
      console.log('To register this guardian, you need to:');
      console.log('1. Call POST /api/guardian/register with this wallet');
      console.log('2. Complete email verification first');
      console.log('');
      console.log('Without registration, Guardian Link operations will fail.');
    }

  } catch (error) {
    console.error('❌ Connection Error:', error.message);
  }
}

checkGuardianRegistered();

// Temporary script to check guardian registration
const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const GUARDIAN_REGISTRY_ADDRESS = process.env.GUARDIAN_REGISTRY_ADDRESS;
const GUARDIAN_ADDRESS = '0xe82e6b878eb622d435771624bc84c32108aad726';

const ABI = [
  'function getGuardianProfile(address) view returns (tuple(address guardianAddress, bytes32 personalDataHash, string ncpStorageURI, uint8 verificationMethod, uint8 verificationLevel, uint48 registeredAt, uint48 lastUpdated, bool isActive))',
];

async function checkGuardian() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(GUARDIAN_REGISTRY_ADDRESS, ABI, provider);

    console.log('🔍 Checking guardian registration...');
    console.log(`Guardian Address: ${GUARDIAN_ADDRESS}`);
    console.log(`Contract Address: ${GUARDIAN_REGISTRY_ADDRESS}`);
    console.log(`RPC URL: ${RPC_URL}\n`);

    const profile = await contract.getGuardianProfile(GUARDIAN_ADDRESS);

    console.log('✅ Guardian Profile Found:');
    console.log(JSON.stringify({
      guardianAddress: profile.guardianAddress,
      personalDataHash: profile.personalDataHash,
      ncpStorageURI: profile.ncpStorageURI,
      verificationMethod: Number(profile.verificationMethod),
      verificationLevel: Number(profile.verificationLevel),
      registeredAt: Number(profile.registeredAt),
      lastUpdated: Number(profile.lastUpdated),
      isActive: profile.isActive,
    }, null, 2));

    if (profile.isActive) {
      console.log('\n🟢 Guardian is ACTIVE and REGISTERED');
    } else {
      console.log('\n🔴 Guardian is registered but DEACTIVATED');
    }
  } catch (error) {
    if (error.message.includes('NotRegistered')) {
      console.log('❌ Guardian NOT REGISTERED on blockchain');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

checkGuardian();

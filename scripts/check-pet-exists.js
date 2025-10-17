// check-pet-exists.js
const { ethers } = require('ethers');

const PET_DID = 'did:ethr:besu:0xd6537c4137ac72c6c8af37c8ef94784bb062d6fea6dd2d9e67ed49b5676f6eed';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';
const PET_REGISTRY_ADDRESS = '0xBF921f94Fd9eF1738bE25D8CeCFDFE2C822c81B0';

const GET_DID_DOC_ABI = [
  "function getDIDDocument(string petDID) view returns (tuple(address biometricOwner, address controller, uint256 created, uint256 updated, bool exists) doc)"
];

async function checkPetExists() {
  try {
    console.log('🔍 Checking if PetDID exists...\n');
    console.log(`PetDID: ${PET_DID}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(PET_REGISTRY_ADDRESS, GET_DID_DOC_ABI, provider);

    const didDoc = await contract.getDIDDocument(PET_DID);

    console.log('📊 Pet Registration Status:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Exists: ${didDoc.exists ? '✅ YES' : '❌ NO'}`);

    if (didDoc.exists) {
      console.log(`Biometric Owner: ${didDoc.biometricOwner}`);
      console.log(`Controller: ${didDoc.controller}`);
      console.log(`Created: ${new Date(Number(didDoc.created) * 1000).toISOString()}`);
      console.log(`Updated: ${new Date(Number(didDoc.updated) * 1000).toISOString()}`);
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('❌ PROBLEM: This PetDID is already registered!');
      console.log('\nThis is why the transaction reverted:');
      console.log('- You cannot register the same PetDID twice');
      console.log('- Same nose print = same biometric hash = same PetDID');
      console.log('\nSolutions:');
      console.log('1. Use a DIFFERENT nose print image');
      console.log('2. If this is the correct pet, use the existing PetDID');
    } else {
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('✅ PetDID does NOT exist yet');
      console.log('Registration should work with a new transaction.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPetExists();

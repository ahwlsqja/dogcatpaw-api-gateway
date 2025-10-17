// decode-function.js
const { ethers } = require('ethers');

const PET_REGISTRY_ABI = [
  "function registerPetDID(string petDID, bytes32 biometricHash, string modelServerReference, uint8 sampleCount, string species, string metadataURI) returns (bool)",
  "function updateController(string petDID, address newController) returns (bool)",
  "function verifyBiometric(string petDID, uint8 similarityScore, uint8 purpose) returns (bool)"
];

const TX_DATA = '0x6835d66d00000000000000000000000000000000000000000000000000000000000000c0d6537c4137ac72c6c8af37c8ef94784bb062d6fea6dd2d9e67ed49b5676f6eed00000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000506469643a657468723a626573753a3078643635333763343133376163373263366338616633376338656639343738346262303632643666656136646432643965363765643439623536373666366565640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000106d6f64656c2d7365727665722d726566000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003646f67000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000013000000000000000000000000000000000000000000000000000000000000000';

const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';
const TX_HASH = '0x6eb323a114471fd4300ac57ab133fd0a60e1c9b31308b33677a9914e2ad92e1e';

async function decodeFunction() {
  try {
    console.log('🔍 Decoding Function Call...\n');

    const iface = new ethers.Interface(PET_REGISTRY_ABI);

    // Decode the function call
    const decoded = iface.parseTransaction({ data: TX_DATA });

    console.log('📊 Function Call:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Function: ${decoded.name}`);
    console.log(`Selector: ${decoded.selector}`);
    console.log('\nArguments:');
    decoded.args.forEach((arg, index) => {
      const param = decoded.fragment.inputs[index];
      console.log(`  ${param.name} (${param.type}): ${arg}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Check if PetDID already exists
    console.log('🔍 Checking if PetDID already exists...\n');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const PET_REGISTRY_ADDRESS = '0xBF921f94Fd9eF1738bE25D8CeCFDFE2C822c81B0';

    const DID_DOC_ABI = [
      "function getDIDDocument(string petDID) view returns (tuple(string did, address controller, uint256 created, uint256 updated, bool exists, address biometricVerifier, string modelServerRef) doc)"
    ];

    const contract = new ethers.Contract(PET_REGISTRY_ADDRESS, DID_DOC_ABI, provider);

    const petDID = decoded.args[0];
    const didDoc = await contract.getDIDDocument(petDID);

    console.log('📊 PetDID Status:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`PetDID: ${petDID}`);
    console.log(`Exists: ${didDoc.exists ? '✅ YES' : '❌ NO'}`);
    if (didDoc.exists) {
      console.log(`Controller: ${didDoc.controller}`);
      console.log(`Created: ${new Date(Number(didDoc.created) * 1000).toISOString()}`);
      console.log('\n❌ PROBLEM: PetDID already exists!');
      console.log('You cannot register the same PetDID twice.');
      console.log('This is why the transaction reverted.');
    }
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

decodeFunction();

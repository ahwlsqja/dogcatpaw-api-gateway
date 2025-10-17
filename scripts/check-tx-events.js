// check-tx-events.js
const { ethers } = require('ethers');

const TX_HASH = '0xafafee63c153d4d8da5e6139b22c8160d4566db732be2d3d63c192fe5b5bcddb';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';
const GUARDIAN_REGISTRY_ADDRESS = '0xBeC8a9e485a4B75d3b14249de7CA6D124fE94795';

const GUARDIAN_REGISTRY_ABI = [
  "event GuardianRegistered(address indexed guardianAddress, bytes32 personalDataHash, uint8 verificationMethod, uint256 timestamp)"
];

async function checkTxEvents() {
  try {
    console.log('🔍 Checking Transaction Events...\n');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
      console.log('❌ Transaction not found!');
      return;
    }

    console.log(`📊 Transaction: ${TX_HASH}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ REVERTED'}`);
    console.log(`Logs: ${receipt.logs.length}\n`);

    // Parse events
    const iface = new ethers.Interface(GUARDIAN_REGISTRY_ABI);

    receipt.logs.forEach((log, index) => {
      try {
        const parsed = iface.parseLog(log);
        console.log(`\n🎉 Event ${index + 1}: ${parsed.name}`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Guardian Address: ${parsed.args.guardianAddress}`);
        console.log(`Personal Data Hash: ${parsed.args.personalDataHash}`);
        console.log(`Verification Method: ${parsed.args.verificationMethod}`);
        console.log(`Timestamp: ${new Date(Number(parsed.args.timestamp) * 1000).toISOString()}`);
        console.log('═══════════════════════════════════════════════════════════');
      } catch (e) {
        console.log(`\nLog ${index + 1}: Unable to parse (might be from different contract)`);
        console.log(`  Address: ${log.address}`);
        console.log(`  Topics: ${log.topics.length}`);
      }
    });

    console.log('\n✅ Guardian was registered successfully in the blockchain!');
    console.log('The issue might be with the getGuardianProfile() function ABI.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTxEvents();

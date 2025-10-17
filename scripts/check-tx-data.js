// check-tx-data.js
const { ethers } = require('ethers');

const TX_HASH = '0x6eb323a114471fd4300ac57ab133fd0a60e1c9b31308b33677a9914e2ad92e1e';
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

async function checkTxData() {
  try {
    console.log('🔍 Checking Transaction Data...\n');

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Get transaction
    const tx = await provider.getTransaction(TX_HASH);

    if (!tx) {
      console.log('❌ Transaction not found!');
      return;
    }

    console.log('📊 Transaction Details:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`From: ${tx.from}`);
    console.log(`To: ${tx.to}`);
    console.log(`Data: ${tx.data}`);
    console.log(`Data Length: ${tx.data.length} chars`);
    console.log(`Value: ${tx.value.toString()}`);
    console.log(`Nonce: ${tx.nonce}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get receipt
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    console.log('📊 Transaction Receipt:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ REVERTED'}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`Logs: ${receipt.logs.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (tx.data === '0x' || tx.data.length <= 2) {
      console.log('❌ PROBLEM FOUND: Transaction has EMPTY data field!');
      console.log('This means no contract function was called.');
      console.log('\nPossible causes:');
      console.log('1. Frontend sent a plain transfer instead of contract call');
      console.log('2. Transaction data was not properly encoded');
      console.log('3. Wrong transaction was submitted');
    } else {
      console.log('✅ Transaction has valid data field');
      console.log(`Function selector: ${tx.data.substring(0, 10)}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTxData();

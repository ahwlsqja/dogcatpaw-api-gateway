// check-tx-receipt.js
const { ethers } = require('ethers');

// 로그에서 보이는 트랜잭션 해시 (전체를 복사하세요)
const TX_HASH = process.argv[2] || '0xef620a68baec06d39b85f4f6963dcae9680f8'; // 이건 일부만
const RPC_URL = 'http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545';

async function checkTxReceipt() {
  try {
    console.log(`🔍 Checking Transaction Receipt...\n`);
    console.log(`TX Hash: ${TX_HASH}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
      console.log('❌ Transaction not found!');
      return;
    }

    console.log('📊 Transaction Receipt:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`Transaction Hash: ${receipt.hash}`);
    console.log(`From: ${receipt.from}`);
    console.log(`To: ${receipt.to}`);
    console.log(`Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ REVERTED'}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`Logs Count: ${receipt.logs.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (receipt.status === 0) {
      console.log('❌ Transaction was REVERTED!');
      console.log('This means the transaction was included in a block but the execution failed.');
      console.log('\nPossible reasons:');
      console.log('- require() condition failed in the smart contract');
      console.log('- Insufficient permissions');
      console.log('- Invalid parameters');
    } else {
      console.log('✅ Transaction was successful!');
      console.log(`\nEvents emitted: ${receipt.logs.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTxReceipt();

// scripts/generate-web3-token.js
const Web3Token = require('web3-token');
const { Wallet } = require('ethers');

async function generateToken(useExistingPrivateKey = null) {
  // Create or use existing wallet
  const wallet = useExistingPrivateKey
    ? new Wallet(useExistingPrivateKey)
    : Wallet.createRandom();

  console.log('='.repeat(60));
  console.log('🔐 Web3 Wallet & Token Generator');
  console.log('='.repeat(60));
  console.log('Wallet Address:', wallet.address);
  console.log('Private Key:', wallet.privateKey);
  console.log();

  // Generate Web3 token
  const token = await Web3Token.sign(
    async (msg) => wallet.signMessage(msg),
    {
      expires_in: '7d',
      statement: 'Sign to authenticate with PetDID',
    }
  );

  console.log('Web3 Token (valid for 7 days):');
  console.log(token);
  console.log();
  console.log('='.repeat(60));
  console.log('📋 Use in Postman Headers:');
  console.log('='.repeat(60));
  console.log('Authorization:', token);
  console.log('walletaddress:', wallet.address.toLowerCase());
  console.log();

  return { wallet, token };
}

// If run directly
if (require.main === module) {
  const privateKey = process.argv[2]; // Optional: node generate-web3-token.js 0x...
  generateToken(privateKey).catch(console.error);
}

module.exports = { generateToken };

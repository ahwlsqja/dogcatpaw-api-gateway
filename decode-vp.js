// Decode VP JWT for debugging
const vpJwt = process.argv[2];

if (!vpJwt) {
  console.log('Usage: node decode-vp.js <VP_JWT>');
  process.exit(1);
}

const parts = vpJwt.split('.');

console.log('=== VP JWT Parts ===\n');
console.log('Header:');
try {
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  console.log(JSON.stringify(header, null, 2));
} catch (e) {
  console.log('Failed to decode header:', e.message);
}

console.log('\nPayload:');
try {
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  console.log(JSON.stringify(payload, null, 2));
} catch (e) {
  console.log('Failed to decode payload:', e.message);
}

console.log('\nSignature (hex):');
try {
  const sig = Buffer.from(parts[2], 'base64url').toString('hex');
  console.log('0x' + sig);
  console.log(`Length: ${sig.length} chars (${sig.length/2} bytes)`);
} catch (e) {
  console.log('Failed to decode signature:', e.message);
}

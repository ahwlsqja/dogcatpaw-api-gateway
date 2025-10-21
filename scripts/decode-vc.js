// decode-vc.js - VC JWT 디코딩 및 분석
const { ethers } = require('ethers');

const WALLET_ADDRESS = '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0';
const API_BASE_URL = 'http://localhost:3000';

async function analyzeVCs() {
  try {
    console.log('🔍 Analyzing VCs for wallet:', WALLET_ADDRESS);
    console.log('');

    // VC 목록 가져오기 (인증 없이 가능한지 확인)
    // 또는 challenge/login 후 VCs 가져오기
    const provider = new ethers.JsonRpcProvider('http://besu-networ-besu-rpc-ext-43e7a-108790139-4b974a576079.kr.lb.naverncp.com:8545');
    const wallet = new ethers.Wallet('960e72438dadcd8a559b922388616d7c352ea1de901ad61644dcc753642eea6b', provider);

    // Login first
    const challengeResponse = await fetch(`${API_BASE_URL}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: WALLET_ADDRESS })
    });
    const challengeData = await challengeResponse.json();

    const challengeSignature = await wallet.signMessage(challengeData.challenge);

    let vpSignature = null;
    let vpMessage = null;

    // Sign VP message if VP signing data exists
    if (challengeData.vpSigningData) {
      console.log('✍️  Signing VP message...');
      vpMessage = challengeData.vpSigningData.message;
      const signingData = challengeData.vpSigningData.signingData;

      // VP 서명 생성
      const signingDataBytes = ethers.toUtf8Bytes(signingData);
      const messageHash = ethers.keccak256(signingDataBytes);
      vpSignature = await wallet.signMessage(messageHash);

      console.log('✅ VP message signed');
    }

    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: WALLET_ADDRESS,
        signature: challengeSignature,
        challenge: challengeData.challenge,
        vpSignature: vpSignature,
        vpMessage: vpMessage
      })
    });
    const loginData = await loginResponse.json();

    console.log('✅ Logged in');
    console.log('Login response keys:', Object.keys(loginData));
    console.log('VP JWT exists:', !!loginData.vpJwt);
    console.log('VP JWT value:', loginData.vpJwt?.substring(0, 100) + '...');

    // VP JWT 디코딩
    if (loginData.vpJwt && loginData.vpJwt !== 'EMPTY') {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📦 VP JWT Analysis');
      console.log('═══════════════════════════════════════════════════════════\n');

      const vpParts = loginData.vpJwt.split('.');
      const vpHeader = JSON.parse(Buffer.from(vpParts[0], 'base64url').toString());
      const vpPayload = JSON.parse(Buffer.from(vpParts[1], 'base64url').toString());
      const vpSignature = '0x' + Buffer.from(vpParts[2], 'base64url').toString('hex');

      console.log('VP Header:', JSON.stringify(vpHeader, null, 2));
      console.log('\nVP Payload:');
      console.log('  Issuer (holder):', vpPayload.iss);
      console.log('  Audience:', vpPayload.aud);
      console.log('  VP Type:', vpPayload.vp?.type);
      console.log('  Holder:', vpPayload.vp?.holder);
      console.log('  VC Count:', vpPayload.vp?.verifiableCredential?.length || 0);

      // VP 서명 검증
      const vpSigningData = `${vpParts[0]}.${vpParts[1]}`;
      const vpMessageHash = ethers.keccak256(ethers.toUtf8Bytes(vpSigningData));
      const vpRecoveredAddress = ethers.verifyMessage(vpMessageHash, vpSignature);
      const vpExpectedAddress = vpPayload.iss?.replace('did:ethr:besu:', '');

      console.log('\nVP Signature Verification:');
      console.log('  Expected (holder):', vpExpectedAddress);
      console.log('  Recovered:', vpRecoveredAddress);
      console.log('  Match:', vpRecoveredAddress.toLowerCase() === vpExpectedAddress?.toLowerCase() ? '✅' : '❌');

      // 각 VC 분석
      const vcs = vpPayload.vp?.verifiableCredential || [];
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log(`📜 VC Analysis (${vcs.length} VCs)`);
      console.log('═══════════════════════════════════════════════════════════\n');

      for (let i = 0; i < vcs.length; i++) {
        const vcJwt = vcs[i];
        console.log(`\n--- VC #${i + 1} ---`);

        const vcParts = vcJwt.split('.');
        const vcHeader = JSON.parse(Buffer.from(vcParts[0], 'base64url').toString());
        const vcPayload = JSON.parse(Buffer.from(vcParts[1], 'base64url').toString());
        const vcSignature = '0x' + Buffer.from(vcParts[2], 'base64url').toString('hex');

        console.log('\nVC Header:', JSON.stringify(vcHeader, null, 2));
        console.log('\nVC Payload:');
        console.log('  Issuer:', vcPayload.iss);
        console.log('  Subject:', vcPayload.sub);
        console.log('  VC Type:', vcPayload.vc?.type);
        console.log('  Credential Subject:', JSON.stringify(vcPayload.vc?.credentialSubject, null, 2));

        // VC 서명 검증
        const vcSigningData = `${vcParts[0]}.${vcParts[1]}`;
        const vcMessageHash = ethers.keccak256(ethers.toUtf8Bytes(vcSigningData));
        const vcRecoveredAddress = ethers.verifyMessage(vcMessageHash, vcSignature);
        const vcIssuerAddress = vcPayload.iss?.replace('did:ethr:besu:', '');

        console.log('\nVC Signature Verification:');
        console.log('  Issuer (expected):', vcIssuerAddress);
        console.log('  Recovered:', vcRecoveredAddress);
        console.log('  Match:', vcRecoveredAddress.toLowerCase() === vcIssuerAddress?.toLowerCase() ? '✅' : '❌');
        console.log('  Is current user?', vcIssuerAddress?.toLowerCase() === WALLET_ADDRESS.toLowerCase() ? '✅ YES' : '❌ NO');

        // Guardian 정보 확인
        if (vcPayload.vc?.credentialSubject?.guardian) {
          console.log('\nGuardian Info:');
          console.log('  Guardian in VC:', vcPayload.vc.credentialSubject.guardian);
          console.log('  Is current user?', vcPayload.vc.credentialSubject.guardian?.toLowerCase() === WALLET_ADDRESS.toLowerCase() ? '✅ YES' : '❌ NO');
        }
      }
    } else {
      console.log('No VP JWT found');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

analyzeVCs();

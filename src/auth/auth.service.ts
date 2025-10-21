import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { ethers } from 'ethers';
import { verifyCredential, verifyPresentation } from 'did-jwt-vc';
import { Resolver } from 'did-resolver';
import { getResolver } from 'ethr-did-resolver';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private resolver: Resolver;
  private provider: ethers.Provider;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // Initialize provider and resolver for DID operations
    const rpcUrl = this.configService.get<string>('RPC_URL') || 'http://localhost:8545';
    const registry = this.configService.get<string>('DID_REGISTRY_ADDRESS');
    const networkName = this.configService.get<string>('NETWORK_NAME') || 'besu';

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Setup resolver with ethr-did-resolver (same as your reference code)
    const providerConfig = {
      rpcUrl,
      registry,
      name: networkName,
    };

    // Use cache: true for performance (like your reference)
    this.resolver = new Resolver(getResolver(providerConfig), { cache: false });
  }

  /**
   * Create login challenge for wallet signature
   */
  async createChallenge(walletAddress: string): Promise<string> {
    const challenge = `Sign this message to authenticate with DogCatPaw:\n\nWallet: ${walletAddress}\nNonce: ${Math.random().toString(36).substring(2)}\nTimestamp: ${Date.now()}`;

    // Store challenge in Redis with 5 minute expiry
    await this.redisService.set(
      `challenge:${walletAddress}`,
      challenge,
      300 // 5 minutes
    );

    return challenge;
  }

  /**
   * Verify wallet signature
   */
  async verifySignature(
    walletAddress: string,
    challenge: string,
    signature: string
  ): Promise<boolean> {
    try {
      // 챌린지 검증
      const storedChallenge = await this.redisService.get(`challenge:${walletAddress}`);

      if (!storedChallenge || storedChallenge !== challenge) {
        return false;
      }

      // 서명 검증
      const recoveredAddress = ethers.verifyMessage(challenge, signature);

      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return false;
      }

      // 챌린지 삭제
      await this.redisService.del(`challenge:${walletAddress}`);

      return true;
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Step 1: Prepare VP data for client-side signing (like vc.service.ts pattern)
   */
  prepareVPSigning(params: {
    holder: string;
    verifiableCredentials: any[];
    audience: string;
    purpose?: string;
    additionalClaims?: any;
  }) {
    const { holder, verifiableCredentials, audience, purpose, additionalClaims } = params;

    const now = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(2);

    // VP JWT Payload (W3C VP 표준)
    const vpPayload = {
      iss: `did:ethr:besu:${holder}`,
      aud: audience,
      nbf: now,
      exp: now + 3600, // 1 hour
      nonce: nonce,
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: `did:ethr:besu:${holder}`,
        verifiableCredential: verifiableCredentials,
      },
    };

    // JWT Header
    const vpHeader = {
      alg: 'ES256K-R',
      typ: 'JWT',
    };

    // Create signing data (header.payload)
    const encodedHeader = Buffer.from(JSON.stringify(vpHeader)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(vpPayload)).toString('base64url');
    const signingData = `${encodedHeader}.${encodedPayload}`;

    return {
      message: vpPayload,
      messageHash: signingData, // JWT에서는 header.payload를 서명
      signingData: signingData,
      header: vpHeader,
      encodedHeader: encodedHeader,
      encodedPayload: encodedPayload,
      instruction: 'Please sign this message to create Verifiable Presentation',
    };
  }

  /**
   * Step 2: Create VP with client's signature (like vc.service.ts pattern)
   */
  async createVPWithSignature(params: {
    holder: string;
    signature: string;
    message: any;
    verifiableCredentials: any[];
    signedData?: string; // Optional: the exact data that was signed
  }): Promise<{ jwt: string; expiresIn: number }> {
    const { holder, signature, message, verifiableCredentials, signedData } = params;

    try {
      // Verify signature (same as VC verification)
      // Use the exact signedData that was sent from client if available
      const header = {
        alg: 'ES256K-R',
        typ: 'JWT',
      };

      let signingData: string;
      if (signedData) {
        // Use the exact data that client signed
        signingData = signedData;
      } else {
        // Fallback: reconstruct (might have JSON serialization differences)
        const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        const encodedPayload = Buffer.from(JSON.stringify(message)).toString('base64url');
        signingData = `${encodedHeader}.${encodedPayload}`;
      }

      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(signingData));
      const recoveredAddress = ethers.verifyMessage(messageHash, signature);

      if (recoveredAddress.toLowerCase() !== holder.toLowerCase()) {
        this.logger.error(`VP signature verification failed: ${recoveredAddress} vs ${holder}`);
        this.logger.error(`Signing data length: ${signingData.length}`);
        this.logger.error(`Message hash: ${messageHash}`);
        this.logger.error(`Signature: ${signature.substring(0, 20)}...`);
        throw new Error('Invalid VP signature');
      }

      this.logger.log(`VP signature verified for ${holder}`);

      // Assemble VP JWT
      const vpJwt = this.assembleVPJWT({
        header,
        payload: message,
        signature,
      });

      // Store VP in Redis for Spring integration if needed
      await this.redisService.set(
        `vp:${holder}`,
        vpJwt,
        3600 // 1 hour
      );

      return {
        jwt: vpJwt,
        expiresIn: 3600,
      };
    } catch (error) {
      this.logger.error('Failed to create VP with signature:', error);
      throw error;
    }
  }

  /**
   * Assemble VP JWT (similar to vc.service.ts pattern)
   */
  private assembleVPJWT(data: {
    header: any;
    payload: any;
    signature: string;
  }): string {
    // Base64 URL encoding
    const encodedHeader = Buffer.from(JSON.stringify(data.header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(data.payload)).toString('base64url');

    // Signature from client (already signed)
    const encodedSignature = Buffer.from(data.signature.slice(2), 'hex').toString('base64url');

    // Assemble JWT
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Verify Verifiable Presentation using manual verification (like VC)
   * Skips did-jwt-vc library to use same verification as VC
   */
  async verifyPresentation(vpJwt: string): Promise<any> {
    try {
      // Decode VP JWT manually
      const parts = vpJwt.split('.');
      if (parts.length !== 3) {
        return { verified: false, error: 'Invalid JWT format' };
      }

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const signature = '0x' + Buffer.from(parts[2], 'base64url').toString('hex');

      // Verify signature manually (same as VC verification)
      const signingData = `${parts[0]}.${parts[1]}`;
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(signingData));

      const recoveredAddress = ethers.verifyMessage(messageHash, signature);
      const expectedAddress = payload.iss?.replace('did:ethr:besu:', '');

      if (recoveredAddress.toLowerCase() !== expectedAddress?.toLowerCase()) {
        this.logger.warn(`VP signature mismatch: ${recoveredAddress} vs ${expectedAddress}`);
        return {
          verified: false,
          error: 'VP signature verification failed'
        };
      }

      this.logger.log(`VP signature verified for ${expectedAddress}`);

      // Verify each VC within the VP (manual verification for custom DID registry)
      const vcs = await Promise.all(
        (payload.vp?.verifiableCredential || []).map(async (vcJwt: string) => {
          try {
            // Decode VC JWT manually
            const vcParts = vcJwt.split('.');
            if (vcParts.length !== 3) {
              return { verified: false, error: 'Invalid VC JWT format' };
            }

            const vcHeader = JSON.parse(Buffer.from(vcParts[0], 'base64url').toString());
            const vcPayload = JSON.parse(Buffer.from(vcParts[1], 'base64url').toString());
            const vcSignature = '0x' + Buffer.from(vcParts[2], 'base64url').toString('hex');

            // Verify VC signature manually (JWT standard)
            // VC는 issuer(guardian)가 header.payload를 서명함
            const vcSigningData = `${vcParts[0]}.${vcParts[1]}`;
            const vcMessageHash = ethers.keccak256(ethers.toUtf8Bytes(vcSigningData));

            const vcRecoveredAddress = ethers.verifyMessage(vcMessageHash, vcSignature);
            const vcIssuerAddress = vcPayload.iss?.replace('did:ethr:besu:', '');

            // VC는 issuer(guardian)가 서명한 것이므로 issuer와 비교
            if (vcRecoveredAddress.toLowerCase() === vcIssuerAddress?.toLowerCase()) {
              this.logger.log(`VC signature verified: issued and signed by ${vcIssuerAddress}`);
              return {
                verified: true,
                credential: vcPayload.vc,
                issuer: vcPayload.iss,
                subject: vcPayload.sub,
              };
            } else {
              this.logger.warn(`VC signature mismatch: recovered ${vcRecoveredAddress} vs issuer ${vcIssuerAddress}`);
              return { verified: false, error: 'VC signature verification failed' };
            }
          } catch (error) {
            this.logger.error('VC verification failed:', error);
            return { verified: false, error: error.message };
          }
        })
      );

      // Check if all VCs are valid
      const allVCsValid = vcs.every(vc => vc.verified);

      if (!allVCsValid) {
        return {
          verified: false,
          error: '모든 VC가 검증되지 않았습니다. VCS의 모든 VC들이 검증되어야합니다!',
          vcs,
        };
      }

      return {
        verified: true,
        holder: payload.iss,
        verifiableCredential: payload.vp?.verifiableCredential,
        payload: payload,
        vcs, // Individual VC verification results
      };
    } catch (error) {
      this.logger.error('VP verification error:', error);
      return {
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Verify individual Verifiable Credential
   */
  async verifyCredential(vcJwt: string): Promise<any> {
    try {
      const result = await verifyCredential(vcJwt, this.resolver);

      if (result && result.verified) {
        return {
          verified: true,
          credential: result.payload.vc,
          issuer: result.payload.iss,
          subject: result.payload.sub,
          issuanceDate: result.payload.iat,
          expirationDate: result.payload.exp,
        };
      }

      return {
        verified: false,
        error: 'VC verification failed'
      };
    } catch (error) {
      this.logger.error('VC verification error:', error);
      return {
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Create access token for API Gateway
   */
  async createAccessToken(payload: {
    address: string;
    isGuardian: boolean;
    vcCount: number;
    role?: number; // Optional role parameter
  }): Promise<string> {
    const token = this.jwtService.sign(
      {
        address: payload.address,
        isGuardian: payload.isGuardian,
        vcCount: payload.vcCount,
        role: payload.role, // Include role in token
        type: 'access',
      },
      {
        expiresIn: '24h',
      }
    );

    // Store in Redis for session management
    await this.redisService.set(
      `token:${payload.address}`,
      token,
      86400 // 24 hours
    );

    return token;
  }

  /**
   * Revoke tokens (logout)
   */
  async revokeTokens(walletAddress: string): Promise<void> {
    await this.redisService.del(`token:${walletAddress}`);
    await this.redisService.del(`challenge:${walletAddress}`);
    await this.redisService.del(`vp:${walletAddress}`);
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<any> {
    try {
      const decoded = this.jwtService.verify(token);

      // Check if token exists in Redis
      const storedToken = await this.redisService.get(`token:${decoded.address}`);
      if (!storedToken || storedToken !== token) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create refresh token
   */
  async createRefreshToken(walletAddress: string): Promise<string> {
    const token = this.jwtService.sign(
      {
        address: walletAddress,
        type: 'refresh',
      },
      {
        expiresIn: '7d',
      }
    );

    await this.redisService.set(
      `refresh:${walletAddress}`,
      token,
      604800 // 7 days
    );

    return token;
  }
}
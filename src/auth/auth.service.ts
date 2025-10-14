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
      // Get stored challenge
      const storedChallenge = await this.redisService.get(`challenge:${walletAddress}`);

      if (!storedChallenge || storedChallenge !== challenge) {
        return false;
      }

      // Verify signature
      const recoveredAddress = ethers.verifyMessage(challenge, signature);

      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return false;
      }

      // Delete used challenge
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

    // Create message to be signed by the client
    const message = {
      vpType: 'AuthenticationPresentation',
      holder: `did:ethr:besu:${holder}`,
      verifiableCredentials,
      audience,
      purpose: purpose || 'authentication',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      nonce: Math.random().toString(36).substring(2),
      ...additionalClaims,
    };

    // Create message hash for signing
    const messageHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(message))
    );

    return {
      message,
      messageHash,
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
  }): Promise<{ jwt: string; expiresIn: number }> {
    const { holder, signature, message, verifiableCredentials } = params;

    try {
      // Verify signature
      const messageHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(message))
      );
      const recoveredAddress = ethers.recoverAddress(messageHash, signature);

      if (recoveredAddress.toLowerCase() !== holder.toLowerCase()) {
        throw new Error('Invalid signature');
      }

      // Assemble VP JWT (similar to vc.service.ts assembleVCJWT)
      const vpJwt = this.assembleVPJWT({
        issuer: holder,
        signature,
        verifiableCredentials,
        message,
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
  private assembleVPJWT(data: any): string {
    // JWT Header
    const header = {
      alg: 'ES256K-R', // Ethereum signature algorithm
      typ: 'JWT',
    };

    // VP Payload following W3C standard
    const payload = {
      iss: `did:ethr:besu:${data.issuer}`,
      aud: data.message.audience,
      nbf: Math.floor(new Date(data.message.issuedAt).getTime() / 1000),
      exp: Math.floor(new Date(data.message.expiresAt).getTime() / 1000),
      nonce: data.message.nonce,
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: `did:ethr:besu:${data.issuer}`,
        verifiableCredential: data.verifiableCredentials,
      },
    };

    // Base64 URL encoding
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Signature from client (already signed)
    const encodedSignature = Buffer.from(data.signature.slice(2), 'hex').toString('base64url');

    // Assemble JWT
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Verify Verifiable Presentation using did-jwt-vc
   * Matches your reference code pattern
   */
  async verifyPresentation(vpJwt: string): Promise<any> {
    try {
      // VP 검증
      const result = await verifyPresentation(vpJwt, this.resolver);

      // VP 검증되었는지 체크
      if (!result || !result.verified) {
        return {
          verified: false,
          error: 'VP 검증 실패'
        };
      }

      // Verify each VC within the VP (like your reference)
      const vcs = await Promise.all(
        result.payload.vp.verifiableCredential.map(async (vcJwt: string) => {
          try {
            const vcResult = await verifyCredential(vcJwt, this.resolver);
            if (vcResult && vcResult.verified) {
              return {
                verified: true,
                credential: vcResult.payload.vc,
                issuer: vcResult.payload.iss,
                subject: vcResult.payload.sub,
              };
            }
            return { verified: false };
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
        holder: result.payload.iss,
        verifiableCredential: result.payload.vp.verifiableCredential,
        payload: result.payload,
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
  }): Promise<string> {
    const token = this.jwtService.sign(
      {
        address: payload.address,
        isGuardian: payload.isGuardian,
        vcCount: payload.vcCount,
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
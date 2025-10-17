// auth/services/token.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class TokenService {

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly redisService: RedisService,
  ) {
  }

  /**
   * 토큰 블록 (로그아웃) - 세션 무효화
   */
  async blockToken(token: string, ttl: number = 86400): Promise<void> {
    const blockKey = `blocked:${token}`;
    
    // Redis에만 저장 (로컬 캐시 불필요)
    await this.redisService.setex(blockKey, ttl, '1');
  }

  /**
   * 토큰이 블록되었는지 확인
   */
  async isTokenBlocked(token: string): Promise<boolean> {
    const blockKey = `blocked:${token}`;
    const blocked = await this.redisService.get(blockKey);
    return blocked === '1';
  }

  /**
   * 지갑 주소로 모든 세션 블록 (전체 로그아웃)
   * 1 Address → N Sessions (multiple VPs)
   */
  async blockAllTokensByAddress(address: string): Promise<void> {
    const pattern = `vp:token:*`;
    const stream = this.redisService.scanStream({ match: pattern });

    for await (const keys of stream) {
      for (const key of keys) {
        const data = await this.redisService.get(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const vpJwt = parsed.vpJwt;

            // Decode VP to check holder (address)
            // VP JWT format: header.payload.signature
            const payload = JSON.parse(
              Buffer.from(vpJwt.split('.')[1], 'base64url').toString()
            );

            const vpHolder = payload.iss?.replace('did:ethr:besu:', '') ||
                           payload.vp?.holder?.replace('did:ethr:besu:', '');

            if (vpHolder?.toLowerCase() === address.toLowerCase()) {
              // Extract token from key: vp:token:{token}
              const token = key.replace('vp:token:', '');

              // Block token and delete VP
              await this.blockToken(token);
              await this.deleteVPForToken(token);
            }
          } catch (error) {
            console.error(`Error processing VP key ${key}:`, error);
          }
        }
      }
    }
  }

  /**
   * VP 당 하나의 세션
   */
  async setVPForToken(token: string, vpJwt: string, ttl: number = 3600): Promise<void> {
    const vpKey = `vp:token:${token}`;
    const data = { vpJwt, createdAt: Date.now() };

    // 레디스에 영속성 저장
    await this.redisService.setex(vpKey, ttl, JSON.stringify(data));

    // 로컬 캐시에도 저장
    await this.cacheManager.set(vpKey, data, Math.min(ttl, 300)); // Max 5 minutes
  }

  /**
   * VP 세션 토큰 GET
   */
  async getVPForToken(token: string): Promise<string | null> {
    const vpKey = `vp:token:${token}`;

    // 1. 로컬 찾아보고 없으면 
    const localCache = await this.cacheManager.get<{ vpJwt: string }>(vpKey);
    if (localCache) {
      return localCache.vpJwt;
    }

    // 2. 레디스 체크
    const redisCache = await this.redisService.get(vpKey);
    if (redisCache) {
      const data = JSON.parse(redisCache);
      // 로컬 캐시 저장
      await this.cacheManager.set(vpKey, data, 60); // 1 minute
      return data.vpJwt;
    }

    return null;
  }

  /**
   * Delete VP JWT mapped to token
   */
  async deleteVPForToken(token: string): Promise<void> {
    const vpKey = `vp:token:${token}`;
    await this.redisService.del(vpKey);
    await this.cacheManager.del(vpKey);
  }

  // ==================== VP Verification Caching ====================

  /**
   * VP 검증 결과 캐싱
   *
   * @param token - Access token
   * @param verificationResult - VP 검증 결과 객체
   * @param ttl - TTL in seconds (default: 3600 = 1 hour)
   *
   * @example
   * await this.tokenService.cacheVPVerification(token, {
   *   verified: true,
   *   holder: 'did:ethr:besu:0x123...',
   *   vcCount: 3,
   *   verifiedAt: Date.now()
   * });
   */
  async cacheVPVerification(
    token: string,
    verificationResult: {
      verified: boolean;
      holder: string;
      vcCount: number;
      verifiedAt?: number;
    },
    ttl: number = 3600
  ): Promise<void> {
    const cacheKey = `vp:verified:${token}`;
    const data = {
      ...verificationResult,
      verifiedAt: verificationResult.verifiedAt || Date.now()
    };

    // Redis에 영속성 저장 (긴 TTL)
    await this.redisService.setex(cacheKey, ttl, JSON.stringify(data));

    // 로컬 캐시에도 저장 (짧은 TTL로 메모리 절약)
    await this.cacheManager.set(cacheKey, data, Math.min(ttl, 300)); // Max 5 minutes
  }

  /**
   * 캐시된 VP 검증 결과 조회
   *
   * @param token - Access token
   * @returns Cached verification result or null if not found/expired
   *
   * @example
   * const cached = await this.tokenService.getCachedVPVerification(token);
   * if (cached && cached.verified) {
   *   // Use cached result
   * } else {
   *   // Perform full verification
   * }
   */
  async getCachedVPVerification(token: string): Promise<{
    verified: boolean;
    holder: string;
    vcCount: number;
    verifiedAt: number;
  } | null> {
    const cacheKey = `vp:verified:${token}`;

    // 1. 로컬 캐시 확인 (빠름)
    const localCache = await this.cacheManager.get<any>(cacheKey);
    if (localCache) {
      return localCache;
    }

    // 2. Redis 확인 (조금 느림)
    const redisCache = await this.redisService.get(cacheKey);
    if (redisCache) {
      const data = JSON.parse(redisCache);
      // 로컬 캐시에 저장 (다음 요청 최적화)
      await this.cacheManager.set(cacheKey, data, 60); // 1 minute
      return data;
    }

    return null;
  }

  /**
   * VP 검증 결과 캐시 삭제
   * (로그아웃 시 또는 VP 무효화 시 호출)
   */
  async deleteCachedVPVerification(token: string): Promise<void> {
    const cacheKey = `vp:verified:${token}`;
    await this.redisService.del(cacheKey);
    await this.cacheManager.del(cacheKey);
  }
}
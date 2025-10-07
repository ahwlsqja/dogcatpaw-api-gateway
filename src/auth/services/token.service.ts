// auth/services/token.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from "@nestjs/config";
import Redis from 'ioredis';
import { envVariableKeys } from 'src/common/const/env.const';

@Injectable()
export class TokenService {
  private redis: Redis;
  
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>(envVariableKeys.redishost) || 'localhost',
      port: this.configService.get<number>(envVariableKeys.redisport) || 6379,
      password: this.configService.get<string>(envVariableKeys.redispassword),
    });
  }

  /**
   * 토큰 검증 결과 캐싱 (L1: 로컬, L2: Redis)
   */
  async getVerifiedToken(token: string): Promise<{ address: string } | null> {
    const cacheKey = `token:${token}`;

    // 1. 로컬 캐시 확인 (빠름)
    const localCache = await this.cacheManager.get<{ address: string }>(cacheKey);
    if (localCache) {
      return localCache;
    }

    // 2. Redis 캐시 확인 (중간)
    const redisCache = await this.redis.get(cacheKey);
    if (redisCache) {
      const data = JSON.parse(redisCache);
      // 로컬 캐시에도 저장 (TTL 짧게)
      await this.cacheManager.set(cacheKey, data, 60); // 1분
      return data;
    }

    return null;
  }

  /**
   * 토큰 검증 결과 저장
   */
  async setVerifiedToken(token: string, address: string, ttl: number = 3600): Promise<void> {
    const cacheKey = `token:${token}`;
    const data = { address };

    // 1. Redis에 저장 (영속성)
    await this.redis.setex(cacheKey, ttl, JSON.stringify(data));

    // 2. 로컬 캐시에도 저장 (빠른 조회)
    await this.cacheManager.set(cacheKey, data, Math.min(ttl, 300)); // 최대 5분
  }

  /**
   * 토큰 블록 (로그아웃)
   */
  async blockToken(token: string, ttl: number = 86400): Promise<void> {
    const blockKey = `blocked:${token}`;
    
    // Redis에만 저장 (로컬 캐시 불필요)
    await this.redis.setex(blockKey, ttl, '1');
  }

  /**
   * 토큰이 블록되었는지 확인
   */
  async isTokenBlocked(token: string): Promise<boolean> {
    const blockKey = `blocked:${token}`;
    const blocked = await this.redis.get(blockKey);
    return blocked === '1';
  }

  /**
   * 지갑 주소로 모든 토큰 블록 (전체 로그아웃)
   */
  async blockAllTokensByAddress(address: string): Promise<void> {
    const pattern = `token:*`;
    const stream = this.redis.scanStream({ match: pattern });

    for await (const keys of stream) {
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.address.toLowerCase() === address.toLowerCase()) {
            // 해당 토큰 블록
            const token = key.replace('token:', '');
            await this.blockToken(token);
            // 캐시에서 삭제
            await this.redis.del(key);
            await this.cacheManager.del(key);
          }
        }
      }
    }
  }
}
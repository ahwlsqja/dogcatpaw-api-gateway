import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { envVariableKeys } from '../const/env.const';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>(envVariableKeys.redishost) || 'localhost',
      port: this.configService.get<number>(envVariableKeys.redisport) || 6379,
      password: this.configService.get<string>(envVariableKeys.redispassword),
    });

    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  getClient(): Redis {
    return this.redis;
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return await this.redis.setex(key, ttl, value);
    }
    return await this.redis.set(key, value);
  }

  async setex(key: string, ttl: number, value: string): Promise<'OK'> {
    return await this.redis.setex(key, ttl, value);
  }

  async del(key: string | string[]): Promise<number> {
    if (Array.isArray(key)) {
      return await this.redis.del(...key);
    }
    return await this.redis.del(key);
  }

  async exists(key: string): Promise<number> {
    return await this.redis.exists(key);
  }

  async expire(key: string, ttl: number): Promise<number> {
    return await this.redis.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  scanStream(options?: { match?: string; count?: number }) {
    return this.redis.scanStream(options);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.redis.keys(pattern);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return await this.redis.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return await this.redis.hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return await this.redis.hgetall(key);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return await this.redis.hdel(key, ...fields);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.redis.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return await this.redis.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return await this.redis.smembers(key);
  }

  async sismember(key: string, member: string): Promise<number> {
    return await this.redis.sismember(key, member);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.redis.zadd(key, score, member);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return await this.redis.zrem(key, ...members);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.redis.zrange(key, start, stop);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.redis.zrevrange(key, start, stop);
  }

  async incr(key: string): Promise<number> {
    return await this.redis.incr(key);
  }

  async decr(key: string): Promise<number> {
    return await this.redis.decr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    return await this.redis.incrby(key, increment);
  }

  async decrby(key: string, decrement: number): Promise<number> {
    return await this.redis.decrby(key, decrement);
  }

  async flushall(): Promise<'OK'> {
    return await this.redis.flushall();
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
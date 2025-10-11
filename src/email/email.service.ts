import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { InjectQueue } from "@nestjs/bull";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bull";
import { Cache } from 'cache-manager';
import { envVariableKeys } from "src/common/const/env.const";
import { RedisService } from "src/common/redis/redis.service";
import { SendEmailJob } from "./email.processor";

@Injectable()
export class EmailService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectQueue('email') private emailQueue: Queue<SendEmailJob>,
  ) {}
  async sendVerificationCode(walletAddress: string, email: string): Promise<any> {
    // 1. 6자리 랜덤 코드 생성
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Redis에 저장 (10분)
    const cacheKey = `email_verify:${walletAddress}`;
    const data = {
      code,
      email,
      attempts: 0,
    };
    await this.redisService.setex(cacheKey, 600, JSON.stringify(data)); // 600초 = 10분

    // 3. 이메일 발송 작업을 큐에 추가 (비동기)
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">PetDID 이메일 인증</h2>
          <p>안녕하세요!</p>
          <p>아래 인증 코드를 입력해주세요:</p>
          <div style="background: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #4CAF50; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">
            • 이 코드는 10분 후 만료됩니다<br>
            • 본인이 요청하지 않은 경우 무시하세요
          </p>
        </div>
      </body>
      </html>
    `;

    try {
      // 큐에 작업 추가 (즉시 반환)
      await this.emailQueue.add('send-verification', {
        to: email,
        subject: '🐾 PetDID 이메일 인증',
        html,
      }, {
        attempts: 3, // 최대 3번 재시도
        backoff: {
          type: 'exponential',
          delay: 2000, // 2초부터 시작
        },
      });

      return {
        success: true,
        message: '인증 코드가 발송되었습니다!',
      };
    } catch (error) {
      console.error('이메일 큐 추가 에러:', error);
      return {
        success: false,
        error: '이메일 발송 요청에 실패했습니다!',
      };
    }
  }

  async verifyCode(walletAddress: string, code: string): Promise<any> {
    const cacheKey = `email_verify:${walletAddress}`;

    // Redis에서 데이터 가져오기
    const cachedData = await this.redisService.get(cacheKey);

    if (!cachedData) {
      return {
        success: false,
        error: '코드가 만료되었거나 존재하지 않습니다!'
      };
    }

    const cached = JSON.parse(cachedData);

    // 시도 횟수 확인
    if (cached.attempts >= 3) {
      // 3번 이상 실패시 캐시 삭제
      await this.redisService.del(cacheKey);
      
      return {
        success: false,
        error: '시도 횟수를 초과했습니다. 다시 인증 코드를 요청해주세요.'
      };
    }

    // 코드 검증
    if (cached.code !== code) {
      // 시도 횟수 증가
      cached.attempts++;
      const ttl = await this.redisService.ttl(cacheKey);
      await this.redisService.setex(cacheKey, ttl > 0 ? ttl : 600, JSON.stringify(cached));

      return {
        success: false,
        error: `잘못된 코드입니다. (${cached.attempts}/3 시도)`,
        remainingAttempts: 3 - cached.attempts
      };
    }

    // 인증 성공 - 캐시 삭제
    await this.redisService.del(cacheKey);

    return {
      success: true,
      message: '이메일 인증이 완료되었습니다!',
      email: cached.email
    };
  }
}
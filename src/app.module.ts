import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { Web3AuthMiddleware } from './auth/middleware/web3-auth.middleware';
import { AuthModule } from './auth/auth.module';
import { VcModule } from './vc/vc.module';
import { EmailModule } from './email/email.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { SpringModule } from './spring/spring.module';
import { GuardianModule } from './guardian/guardian.module';
import { PetModule } from './pet/pet.module';
import { RedisModule } from './common/redis/redis.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseTimeInterceptor } from './common/interceptor/response-time.interceptor';
import { CommonModule } from './common/common.module';
import { NoseEmbedderModule } from './nose-embedding/nose-embedding.module';
import { envVariableKeys } from './common/const/env.const';
import { AdminModule } from './admin/admin.module';
import { IndexerModule } from './indexer/indexer.module';
import { ChatModule } from './chat/chat.module';
import { FaucetModule } from './faucet/faucet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow(''),
        HASH_ROUNDS: Joi.number().default(10),
        ACCESS_TOKEN_SECRET: Joi.string().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
      }),
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('BULL_REDIS_HOST') || configService.get<string>(envVariableKeys.redishost),
          port: configService.get<number>('BULL_REDIS_PORT') || configService.get<number>(envVariableKeys.redisport),
          // password: configService.get<string>('BULL_REDIS_PASSWORD') || configService.get<string>(envVariableKeys.redispassword),
        },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    AuthModule,
    VcModule,
    EmailModule,
    BlockchainModule,
    SpringModule,
    GuardianModule,
    PetModule,
    CommonModule,
    NoseEmbedderModule,
    AdminModule,
    IndexerModule,
    ChatModule,
    FaucetModule,
  ],
  providers: [{
    provide: APP_INTERCEPTOR,
    useClass: ResponseTimeInterceptor
  }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(Web3AuthMiddleware)
      .forRoutes('*');
  }
}

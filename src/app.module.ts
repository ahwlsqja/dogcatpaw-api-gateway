import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { CacheModule } from '@nestjs/cache-manager';
import { Web3AuthMiddleware } from './auth/middleware/web3-auth.middleware';
import { AuthModule } from './auth/auth.module';
import { VcModule } from './vc/vc.module';
import { EmailModule } from './email/email.module';
import { GuardianModule } from './guardian/guardian.module';
import { PetModule } from './pet/pet.module';
import { RedisModule } from './common/redis/redis.module';

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
    RedisModule,
    AuthModule,
    VcModule,
    EmailModule,
    GuardianModule,
    PetModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(Web3AuthMiddleware)
      .forRoutes('*');
  }
}

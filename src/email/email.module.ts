import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailProcessor } from './email.processor';
import { VcModule } from 'src/vc/vc.module';
import { RedisModule } from 'src/common/redis/redis.module';

@Module({
  imports: [
    RedisModule,
    VcModule,
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [EmailController],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService]
})
export class EmailModule {}

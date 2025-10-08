import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { VcModule } from 'src/vc/vc.module';
import { RedisModule } from 'src/common/redis/redis.module';

@Module({
  imports: [RedisModule, VcModule],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService]
})
export class EmailModule {}

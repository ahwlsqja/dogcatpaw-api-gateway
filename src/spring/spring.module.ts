import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { SpringService } from './spring.service';
import { SpringProxyService } from './spring.proxy.service';
import { SpringController } from './spring.controller';
import { SpringProcessor } from './spring.processor';
import { VcModule } from 'src/vc/vc.module';

@Module({
  imports: [
    HttpModule,
    VcModule,
    BullModule.registerQueue({
      name: 'spring-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [SpringController],
  providers: [SpringService, SpringProxyService, SpringProcessor],
  exports: [SpringService, SpringProxyService],
})
export class SpringModule {}
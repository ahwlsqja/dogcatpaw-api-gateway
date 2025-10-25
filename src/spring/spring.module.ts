import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { SpringService } from './spring.service';
import { SpringProxyService } from './spring.proxy.service';
import { SpringController } from './spring.controller';
import { SpringProcessor } from './spring.processor';
import { ImageMoveProcessor } from './image-move.processor';
import { VcModule } from 'src/vc/vc.module';
import { AuthModule } from 'src/auth/auth.module';
import { RoleBasedGuard } from 'src/admin/guard/role-based.guard';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    HttpModule,
    VcModule,
    CommonModule,
    forwardRef(() => AuthModule),
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
    BullModule.registerQueue({
      name: 'image-move',
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
  providers: [SpringService, SpringProxyService, SpringProcessor, ImageMoveProcessor, RoleBasedGuard],
  exports: [SpringService, SpringProxyService],
})
export class SpringModule {}
import { Module } from '@nestjs/common';
import { GuardianService } from './guardian.service';
import { GuardianController } from './guardian.controller';
import { VcModule } from 'src/vc/vc.module';
import { SpringModule } from 'src/spring/spring.module';

@Module({
  imports: [VcModule, SpringModule],
  controllers: [GuardianController],
  providers: [GuardianService],
  exports: [GuardianService],
})
export class GuardianModule {}

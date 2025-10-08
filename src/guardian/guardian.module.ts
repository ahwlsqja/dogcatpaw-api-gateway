import { Module } from '@nestjs/common';
import { GuardianService } from './guardian.service';
import { GuardianController } from './guardian.controller';
import { VcModule } from 'src/vc/vc.module';

@Module({
  imports: [VcModule],
  controllers: [GuardianController],
  providers: [GuardianService],
  exports: [GuardianService],
})
export class GuardianModule {}

// api-gateway/src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './guard/admin-auth.guard';
import { PetModule } from 'src/pet/pet.module';
import { GuardianModule } from 'src/guardian/guardian.module';

@Module({
  imports: [PetModule, GuardianModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}

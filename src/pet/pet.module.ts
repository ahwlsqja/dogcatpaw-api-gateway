import { Module } from '@nestjs/common';
import { PetService } from './pet.service';
import { PetController } from './pet.controller';
import { VcModule } from 'src/vc/vc.module';
import { NoseEmbedderModule } from 'src/nose-embedding/nose-embedding.module';
import { GuardianModule } from 'src/guardian/guardian.module';
import { BlockchainModule } from 'src/blockchain/blockchain.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [VcModule, NoseEmbedderModule, GuardianModule, BlockchainModule, CommonModule],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}

import { Module } from '@nestjs/common';
import { PetService } from './pet.service';
import { PetController } from './pet.controller';
import { VcModule } from 'src/vc/vc.module';
import { NoseEmbedderModule } from 'src/nose-embedding/nose-embedding.module';

@Module({
  imports: [VcModule, NoseEmbedderModule],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}

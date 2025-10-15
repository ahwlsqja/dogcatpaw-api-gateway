// api-gateway/src/blockchain/blockchain.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BlockchainProcessor } from './blockchain.processor';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'blockchain',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds initial delay
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [BlockchainProcessor, BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
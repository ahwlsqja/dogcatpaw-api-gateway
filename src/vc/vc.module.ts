// api-gateway/src/vc/vc.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BullModule } from '@nestjs/bull';
import { join } from 'path';
import { VcController } from './vc.controller';
import { VcService } from './vc.service';
import { VcProxyService } from './vc.proxy.service';
import { VcQueueService } from './vc-queue.service';
import { VcProcessor } from './vc.processor';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'VC_GRPC_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'vc',
          protoPath: join(__dirname, '../../proto/vc.proto'),
          url: process.env.VC_SERVICE_URL || 'localhost:50051',
          loader: {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
          },
        },
      },
    ]),
    BullModule.registerQueue({
      name: 'vc-queue',
    }),
  ],
  controllers: [VcController],
  providers: [VcService, VcProxyService, VcQueueService, VcProcessor],
  exports: [VcService, VcProxyService, VcQueueService],
})
export class VcModule {}
// api-gateway/src/faucet/faucet.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { FaucetController } from './faucet.controller';
import { FaucetProxyService } from './faucet.proxy.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'FAUCET_GRPC_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'faucet',
          protoPath: join(__dirname, '../../proto/faucet.proto'),
          url: process.env.FAUCET_SERVICE_URL || 'localhost:50054',
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
  ],
  controllers: [FaucetController],
  providers: [FaucetProxyService],
  exports: [FaucetProxyService],
})
export class FaucetModule {}

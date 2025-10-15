// api-gateway/src/indexer/indexer.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { IndexerProxyService } from './indexer.proxy.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'INDEXER_GRPC_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'indexer',
            protoPath: join(__dirname, '../../proto/indexer.proto'),
            url: configService.get<string>('INDEXER_SERVICE_URL') || 'localhost:50053',
            loader: {
              keepCase: true,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [IndexerProxyService],
  exports: [IndexerProxyService],
})
export class IndexerModule {}

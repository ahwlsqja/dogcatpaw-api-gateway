// NestJS Module Example
// Copy this to your NestJS project (e.g., src/nose-embedder/nose-embedder.module.ts)

import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { NoseEmbedderController } from './nose-embedding.controller';
import { NoseEmbedderProxyService } from './nose-embedding.proxy.service';


@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOSE_EMBEDDER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'nose_embedder',
          protoPath: join(__dirname, '../../proto/nose_embedder.proto'), // Adjust path to your proto file location
          url: 'localhost:50052', // gRPC server address (FastAPI server)
          loader: {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
            bytes: Array
          },
        },
      },
    ]),
  ],
  controllers: [NoseEmbedderController],
  providers: [NoseEmbedderProxyService],
  exports: [NoseEmbedderProxyService],
})
export class NoseEmbedderModule {}

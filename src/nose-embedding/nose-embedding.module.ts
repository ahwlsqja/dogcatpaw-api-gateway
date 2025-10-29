// NestJS Module Example
// Copy this to your NestJS project (e.g., src/nose-embedder/nose-embedder.module.ts)

import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { NoseEmbedderController } from './nose-embedding.controller';
import { NoseEmbedderProxyService } from './nose-embedding.proxy.service';
import { envVariableKeys } from 'src/common/const/env.const';


@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'NOSE_EMBEDDER_PACKAGE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => {
          const mlServiceUrl = configService.get<string>(envVariableKeys.mlServiceUrl) || 'localhost:50052';
          console.log(`🔧 [NoseEmbedderModule] ML Service URL: ${mlServiceUrl}`);

          return {
            transport: Transport.GRPC,
            options: {
              package: 'nose_embedder',
              protoPath: join(__dirname, '../../proto/nose_embedder.proto'),
              url: mlServiceUrl, // gRPC server address (FastAPI server)
              loader: {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
                bytes: Array
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [NoseEmbedderController],
  providers: [NoseEmbedderProxyService],
  exports: [NoseEmbedderProxyService],
})
export class NoseEmbedderModule {}

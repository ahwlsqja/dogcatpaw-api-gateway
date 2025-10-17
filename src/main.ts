import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder } from '@nestjs/swagger';
import { SwaggerModule } from '@nestjs/swagger';
// import { WsAuthAdapter } from './chat/adapter/ws-auth.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // WebSocket VP 인증 어댑터 설정
  // app.useWebSocketAdapter(new WsAuthAdapter(app));

  // CORS 활성화(옵션, 클라이언트 웹 개발시 필요)
  app.enableCors();
  
  const config = new DocumentBuilder()
    .setTitle('DID API Gateway')
    .setDescription('DID API Gateway for VC Service and other services')
    .setVersion('1.0')
    .addTag('vc')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document,{
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(3000);
  console.log(`did-api-gateway is listening on: ${await app.getUrl()}`);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder } from '@nestjs/swagger';
import { SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

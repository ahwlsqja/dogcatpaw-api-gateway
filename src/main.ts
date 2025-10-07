import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // CORS 활성화(옵션, 클라이언트 웹 개발시 필요)
  app.enableCors();
  await app.listen(3000);
  console.log(`did-api-gateway is listening on: ${await app.getUrl()}`);
}
bootstrap();

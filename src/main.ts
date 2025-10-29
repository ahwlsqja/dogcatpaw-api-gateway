import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder } from '@nestjs/swagger';
import { SwaggerModule } from '@nestjs/swagger';
import { WsAuthAdapter } from './chat/adapter/ws-auth.adapter';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from './common/const/env.const';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // WebSocket VP 인증 어댑터 설정
  app.useWebSocketAdapter(new WsAuthAdapter(app));

  // CORS 설정 (환경변수 기반)
  const corsOrigin = configService.get<string>(envVariableKeys.corsOrigin);
  const corsCredentials = configService.get<string>(envVariableKeys.corsCredentials) === 'true';

  // CORS origin 파싱 (쉼표로 구분된 여러 origin 지원)
  const allowedOrigins = corsOrigin
    ? corsOrigin.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001']; // 기본값: 로컬 개발 환경

  app.enableCors({
    origin: (origin, callback) => {
      // origin이 없는 경우 (예: 모바일 앱, Postman 등)는 허용
      if (!origin) {
        return callback(null, true);
      }

      // allowedOrigins에 '*'가 있으면 모든 origin 허용
      if (allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // allowedOrigins 리스트에 있는지 확인
      if (allowedOrigins.some(allowedOrigin => {
        // 와일드카드 패턴 지원 (예: https://*.example.com)
        if (allowedOrigin.includes('*')) {
          const pattern = new RegExp('^' + allowedOrigin.replace(/\*/g, '.*') + '$');
          return pattern.test(origin);
        }
        return allowedOrigin === origin;
      })) {
        return callback(null, true);
      }

      // 허용되지 않은 origin
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: corsCredentials, // 쿠키 전송 허용 여부
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Wallet-Address'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400, // Preflight 캐시 시간 (24시간)
  });

  console.log(`✅ CORS enabled for origins: ${allowedOrigins.join(', ')}`);
  console.log(`✅ CORS credentials: ${corsCredentials}`);
  
  const config = new DocumentBuilder()
    .setTitle('DID API Gateway')
    .setDescription('DID API Gateway for VC Service and other services')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Admin-Key',
        in: 'header',
        description: 'Admin API Key for administrative endpoints',
      },
      'X-Admin-Key',
    )
    .addTag('Admin', 'Admin endpoints for blockchain management')
    .addTag('Authentication', 'Authentication endpoints')
    .addTag('Guardian', 'Guardian management endpoints')
    .addTag('Pet', 'Pet registration and management')
    .addTag('VC', 'Verifiable Credentials endpoints')
    .addTag('Email', 'Email verification endpoints')
    .addTag('Spring Backend Proxy', 'Spring backend proxy endpoints')
    .addTag('Common', 'Common utility endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document,{
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(3001);
  console.log(`did-api-gateway is listening on: ${await app.getUrl()}`);
}
bootstrap();

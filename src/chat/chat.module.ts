// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SpringModule } from '../spring/spring.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    SpringModule,
    AuthModule,
  ],
  providers: [ChatGateway, ChatService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}

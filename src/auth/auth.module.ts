import { Module } from "@nestjs/common";
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./services/token.service";
import { RedisModule } from "src/common/redis/redis.module";
import { VcModule } from "src/vc/vc.module";

@Module({
    imports: [
        RedisModule,
        VcModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('ACCESS_TOKEN_SECRET') || 'dogcatpaw-secret-key',
                signOptions: {
                    expiresIn: '24h',
                    algorithm: 'HS256',
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, TokenService],
    exports: [AuthService, TokenService]
})
export class AuthModule {}
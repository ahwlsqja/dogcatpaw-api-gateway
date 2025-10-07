import { CacheModule } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { TokenService } from "./services/token.service";

@Module({
    imports: [
        CacheModule.register({
            isGlobal: true,
        }),
    ],
    controllers: [AuthController],
    providers: [TokenService],
    exports: [TokenService]
})
export class AuthModule {}
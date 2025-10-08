import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { TokenService } from "./services/token.service";
import { RedisModule } from "src/common/redis/redis.module";

@Module({
    imports: [RedisModule],
    controllers: [AuthController],
    providers: [TokenService],
    exports: [TokenService]
})
export class AuthModule {}
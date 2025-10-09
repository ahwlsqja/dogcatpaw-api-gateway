import { Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CommonService } from "./common.service";

@Controller('common')
@ApiBearerAuth()
@ApiTags('common')
export class CommonController {
    constructor(
        private readonly commonService: CommonService,
    ) {}

    @Post()
    async createPresignedUrl(){
        return {
            url: await this.commonService.createPresignedUrl(),
        }
    }
}
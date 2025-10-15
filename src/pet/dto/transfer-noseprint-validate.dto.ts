import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class TranferImageUrlDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
      description: "이미지 이름",
      example: 'aaa-bbb-ccc-ddd-eee.jpg'
  })
  image?: string;
}
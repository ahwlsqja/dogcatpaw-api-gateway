import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class TranferImageUrlDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
      description: 'Nose print image filename uploaded by new guardian for biometric verification. Must be uploaded to S3 temp folder first using POST /common. This image will be compared against the stored pet nose print.',
      example: 'aaa-bbb-ccc-ddd-eee.jpg'
  })
  image?: string;
}
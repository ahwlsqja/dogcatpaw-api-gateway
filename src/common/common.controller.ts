import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { CommonService } from "./common.service";
import { DIDAuthGuard } from "../auth/guard/did-auth-guard";
import { PresignedUrlResponseDto } from "./dto/presigned-url.dto";

@Controller('common')
@UseGuards(DIDAuthGuard)
@ApiBearerAuth('access-token')
@ApiTags('Common')
export class CommonController {
    constructor(
        private readonly commonService: CommonService,
    ) {}

    @Post()
    @ApiOperation({
        summary: 'Generate S3 Presigned URL for Image Upload',
        description: `
**Get a presigned URL for direct S3 image upload**

This endpoint generates a temporary presigned URL that allows clients to upload images directly to AWS S3.

**Use Cases:**
- Pet registration photos
- Adoption post images
- Daily story images
- Review story images
- Guardian profile pictures

**Upload Flow:**
1. Call this endpoint to get a presigned URL
2. Upload your image file directly to the presigned URL using PUT request
3. Use the S3 object key returned in the response for subsequent API calls

**Important:**
- Presigned URLs are temporary and expire after a set time
- Upload should use PUT method directly to the presigned URL
- Content-Type should match the image type (e.g., image/jpeg, image/png)
- Maximum file size and allowed formats may be enforced

**Example Usage:**
\`\`\`javascript
// Step 1: Get presigned URL
const { url, key } = await fetch('/common', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
}).then(r => r.json());

// Step 2: Upload image to S3
await fetch(url, {
  method: 'PUT',
  body: imageFile,
  headers: { 'Content-Type': 'image/jpeg' }
});

// Step 3: Use the key in your API request
await fetch('/pet/register', {
  method: 'POST',
  body: JSON.stringify({ imageKey: key, ... })
});
\`\`\`
        `,
    })
    @ApiResponse({
        status: 200,
        description: 'Presigned URL generated successfully',
        type: PresignedUrlResponseDto,
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Invalid or expired token',
    })
    async createPresignedUrl(){
        return {
            url: await this.commonService.createPresignedUrl(),
        }
    }
}
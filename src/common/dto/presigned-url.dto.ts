import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({
    description: 'Presigned URL for direct S3 upload',
    example: 'https://your-bucket.s3.amazonaws.com/uploads/image-uuid.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&...',
  })
  url: string;

  @ApiProperty({
    description: 'S3 object key to use in subsequent API calls',
    example: 'uploads/image-uuid.jpg',
    required: false,
  })
  key?: string;
}

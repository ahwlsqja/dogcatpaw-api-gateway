import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateAdoptionPostDto {
  @ApiProperty({
    description: 'Pet ID from Spring backend database. This pet must already be registered in the Spring pet table. Get available pet IDs from GET /api/pet endpoint.',
    example: 12345
  })
  @IsNumber()
  @IsNotEmpty()
  petId: number;

  @ApiProperty({
    description: 'Adoption post title. Should be descriptive and appealing to potential adopters (e.g., "사랑스러운 골든 리트리버 입양하세요!").',
    example: '사랑스러운 골든 리트리버 입양하세요!',
    minLength: 5,
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Comma-separated list of image filenames. Upload images to S3 using POST /common first. Images should show the pet clearly from different angles.',
    example: 'pet-photo-1.jpg,pet-photo-2.jpg,pet-photo-3.jpg'
  })
  @IsString()
  @IsNotEmpty()
  images: string;

  @ApiProperty({
    description: 'Detailed post content describing the pet\'s personality, health status, adoption requirements, and care needs. Use markdown formatting if supported.',
    example: '건강하고 활발한 골든 리트리버입니다. 산책을 좋아하며 아이들과도 잘 지냅니다. 예방접종 완료, 중성화 수술 완료.'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Region/Province for location filtering (e.g., "서울", "경기", "부산"). Used for location-based adoption post filtering.',
    example: '서울',
    required: false
  })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiProperty({
    description: 'District/City within the region (e.g., "강남구", "수원시"). Provides more specific location for potential adopters.',
    example: '강남구',
    required: false
  })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiProperty({
    description: 'Shelter or organization name (required for ADMIN role guardians, optional for USER role). Displayed to show the source of the adoption post.',
    example: '서울 유기견 보호소',
    required: false
  })
  @IsString()
  @IsOptional()
  shelterName?: string;

  @ApiProperty({
    description: 'Contact information for adoption inquiries (phone number, email, or Kakao ID). Shown to interested adopters.',
    example: '010-1234-5678 또는 kakao: petlover123',
    required: false
  })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiProperty({
    description: 'Adoption deadline in ISO 8601 format (YYYY-MM-DD). Post will be marked as expired after this date.',
    example: '2025-12-31',
    required: false
  })
  @IsString()
  @IsOptional()
  deadLine?: string;

  @ApiProperty({
    description: 'Adoption post status: "OPEN" (accepting applications), "PENDING" (under review), "CLOSED" (completed/cancelled). Defaults to "OPEN".',
    example: 'OPEN',
    enum: ['OPEN', 'PENDING', 'CLOSED'],
    default: 'OPEN',
    required: false
  })
  @IsString()
  @IsOptional()
  status?: string;
}

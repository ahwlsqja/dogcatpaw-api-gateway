import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateDailyStoryDto {
  @ApiProperty({
    description: 'Pet ID from Spring backend database. This pet must be owned by the authenticated user. Get your pet IDs from GET /api/pet endpoint.',
    example: 12345
  })
  @IsNumber()
  @IsNotEmpty()
  petId: number;

  @ApiProperty({
    description: 'Daily story title. Should be engaging and describe the day\'s activity or moment (e.g., "오늘 첫 산책 다녀왔어요!", "새로운 장난감과 놀았어요").',
    example: '오늘 첫 산책 다녀왔어요!',
    minLength: 2,
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Daily story content describing your pet\'s daily activities, behaviors, or special moments. Share memorable experiences with the pet community.',
    example: '오늘 처음으로 공원에서 산책을 했습니다. 다른 강아지들과 잘 어울려 놀았고, 새로운 친구도 사귀었어요. 너무 행복해하는 모습이 귀여웠습니다!'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Comma-separated list of image filenames showing your pet\'s daily moments. Upload images to S3 using POST /common first. Maximum 10 images recommended.',
    example: 'daily-walk-1.jpg,daily-walk-2.jpg,playing-with-friends.jpg',
    required: false
  })
  @IsString()
  @IsOptional()
  images?: string;
}

export class CreateReviewStoryDto {
  @ApiProperty({
    description: 'Pet ID from Spring backend database. This pet must be owned by the authenticated user and should have been adopted (not originally owned).',
    example: 12345
  })
  @IsNumber()
  @IsNotEmpty()
  petId: number;

  @ApiProperty({
    description: 'Adoption review title. Should describe the adoption experience (e.g., "최고의 선택이었어요!", "우리 가족이 되어줘서 고마워").',
    example: '최고의 선택이었어요! 행복한 입양 후기',
    minLength: 5,
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Detailed adoption review content describing the adoption process, how the pet adapted to the new home, and overall experience. Help other potential adopters by sharing your story.',
    example: '3개월 전 보호소에서 입양했습니다. 처음엔 낯설어했지만 지금은 완전히 적응했어요. 매일이 행복하고 입양을 결심한 것이 제 인생 최고의 선택이었습니다. 입양을 고민하시는 분들께 강력 추천합니다!'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Name of the shelter, rescue organization, or individual from where the pet was adopted. This helps promote good adoption agencies and build trust.',
    example: '서울 유기견 보호소'
  })
  @IsString()
  @IsNotEmpty()
  adoptionAgency: string;

  @ApiProperty({
    description: 'Date when the pet was adopted, in ISO 8601 format (YYYY-MM-DD). Used to show how long you\'ve been together.',
    example: '2024-07-15'
  })
  @IsString()
  @IsNotEmpty()
  adoptionDate: string;

  @ApiProperty({
    description: 'Comma-separated list of image filenames showing your adoption journey and life with your pet. Upload images to S3 using POST /common first. Include before/after photos if available.',
    example: 'adoption-day-1.jpg,first-week-home.jpg,happy-together.jpg',
    required: false
  })
  @IsString()
  @IsOptional()
  images?: string;
}

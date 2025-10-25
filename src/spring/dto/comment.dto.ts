import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class WriteCommentDto {
  @ApiProperty({
    description: 'Story ID to comment on. Can be either a daily story ID or adoption review story ID. Get story IDs from GET /api/story/daily/stories or GET /api/story/review/reviews endpoints.',
    example: 789
  })
  @IsNumber()
  @IsNotEmpty()
  storyId: number;

  @ApiProperty({
    description: 'Comment text content. Share your thoughts, encouragement, or questions about the story. Be respectful and supportive to the pet guardian community.',
    example: '정말 귀여운 강아지네요! 행복한 모습이 보기 좋습니다 :)',
    minLength: 1,
    maxLength: 500
  })
  @IsString()
  @IsNotEmpty()
  comment: string;
}

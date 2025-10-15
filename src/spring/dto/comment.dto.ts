import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class WriteCommentDto {
  @ApiProperty({ description: 'Story ID' })
  @IsNumber()
  @IsNotEmpty()
  storyId: number;

  @ApiProperty({ description: 'Comment text' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}

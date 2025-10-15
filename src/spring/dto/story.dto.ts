import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateDailyStoryDto {
  @ApiProperty({ description: 'Pet ID' })
  @IsNumber()
  @IsNotEmpty()
  petId: number;

  @ApiProperty({ description: 'Story title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Story content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateReviewStoryDto {
  @ApiProperty({ description: 'Pet ID' })
  @IsNumber()
  @IsNotEmpty()
  petId: number;

  @ApiProperty({ description: 'Review title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Review content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'Adoption agency' })
  @IsString()
  @IsNotEmpty()
  adoptionAgency: string;

  @ApiProperty({ description: 'Adoption date (ISO format)' })
  @IsString()
  @IsNotEmpty()
  adoptionDate: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateAdoptionPostDto {
  @ApiProperty({ description: 'Pet ID' })
  @IsNumber()
  @IsNotEmpty()
  petId: number;

  @ApiProperty({ description: 'Post title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Image URLS' })
  @IsString()
  @IsNotEmpty()
  images: string;

  @ApiProperty({ description: 'Post content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'Region', required: false })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiProperty({ description: 'District', required: false })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiProperty({ description: 'Shelter name', required: false })
  @IsString()
  @IsOptional()
  shelterName?: string;

  @ApiProperty({ description: 'Contact information', required: false })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiProperty({ description: 'Deadline', required: false })
  @IsString()
  @IsOptional()
  deadLine?: string;

  @ApiProperty({ description: 'Status', required: false })
  @IsString()
  @IsOptional()
  status?: string;
}

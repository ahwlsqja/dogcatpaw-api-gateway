import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshRequestDto {
  @ApiProperty({
    description: 'Refresh token obtained from login',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHhlOWViYzY5MWNjZmIxNWNiNGJmMzFhZjgzYzYyNGI3MDIwZjBkMmMwIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE2MzE2MzY0MDAsImV4cCI6MTYzMjI0MTIwMH0.abcdef1234567890',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'Refresh operation success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'New JWT access token for API authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'New refresh token (token rotation)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Token refreshed successfully',
  })
  message: string;
}

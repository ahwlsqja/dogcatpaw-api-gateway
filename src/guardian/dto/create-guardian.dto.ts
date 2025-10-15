import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEthereumAddress, IsEmail } from 'class-validator';

export class CreateGuardianDto {
  @ApiPropertyOptional({
    description: '이메일 주소',
    example: 'user@example.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: '전화번호',
    example: '+82-10-1234-5678'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: '이름',
    example: '홍길동'
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '성별',
    example: 'M'
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: '나이',
    example: 30
  })
  @IsOptional()
  @IsNumber()
  old?: number;

  @ApiPropertyOptional({
    description: '주소',
    example: '서울시 강남구'
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: '보호자 지갑 주소 (인증 시 자동으로 설정됨)',
    example: '0x1234567890123456789012345678901234567890'
  })
  @IsOptional()
  @IsEthereumAddress()
  walletAddress?: string;

  @ApiPropertyOptional({
    description: '개인 데이터 해시 (프라이빗 네트워크에서는 더미 값 사용)',
    default: '0x0000000000000000000000000000000000000000000000000000000000000001'
  })
  @IsOptional()
  @IsString()
  personalDataHash?: string;

  @ApiPropertyOptional({
    description: 'NCP 저장소 URI (프라이빗 네트워크에서는 사용 안함)',
    default: '0'
  })
  @IsOptional()
  @IsString()
  ncpStorageURI?: string;

  @ApiPropertyOptional({
    description: '인증 방법 (1: SMS, 2: Email, 3: Both)',
    default: 1,
    enum: [1, 2, 3]
  })
  @IsOptional()
  @IsNumber()
  verificationMethod?: number;

  @ApiPropertyOptional({
    description: '서명된 트랜잭션 (프로덕션 모드에서만 필요)',
    example: '0x...'
  })
  @IsOptional()
  @IsString()
  signedTx?: string;
}

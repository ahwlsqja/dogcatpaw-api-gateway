import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateDonationPostDto {
  @ApiProperty({
    description: 'Member ID from Spring backend database (automatically extracted from JWT token, usually not needed in request body).',
    example: 123
  })
  @IsNumber()
  @IsNotEmpty()
  memberId: number;

  @ApiProperty({
    description: 'Pet ID for which the donation is being raised. This pet should be owned by the authenticated user. Get your pet IDs from GET /api/pet endpoint.',
    example: 12345
  })
  @IsNumber()
  @IsNotEmpty()
  petId: number;

  @ApiProperty({
    description: 'Donation post title. Should clearly state the purpose and urgency (e.g., "긴급 수술비 후원 요청", "치료비 지원 부탁드립니다").',
    example: '긴급 수술비 후원 요청 - 다리 골절 치료',
    minLength: 5,
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Target donation amount in KRW (Korean Won). This is the total amount needed to cover the medical expenses or other costs.',
    example: 3000000,
    minimum: 10000
  })
  @IsNumber()
  @IsNotEmpty()
  targetAmount: number;

  @ApiProperty({
    description: 'Donation deadline in ISO 8601 format (YYYY-MM-DD). After this date, the donation post may be closed or marked as expired.',
    example: '2025-11-30'
  })
  @IsString()
  @IsNotEmpty()
  deadline: string;

  @ApiProperty({
    description: 'Donation category: "MEDICAL" (medical treatment/surgery), "FOOD" (food support), "SHELTER" (shelter costs), or "OTHER" (other needs).',
    example: 'MEDICAL',
    enum: ['MEDICAL', 'FOOD', 'SHELTER', 'OTHER']
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Detailed explanation of why the donation is needed. Include medical diagnosis, treatment plan, cost breakdown, and pet\'s current condition. Be transparent to build trust with donors.',
    example: '교통사고로 인해 뒷다리가 골절되었습니다. 수술비 300만원이 필요하며, 현재 병원에서 응급처치를 받은 상태입니다. 빠른 수술이 필요한 상황으로 여러분의 도움이 절실합니다.'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Comma-separated list of image filenames showing medical records, vet receipts, or pet condition. Upload images to S3 using POST /common first. Include evidence to build trust.',
    example: 'xray-image.jpg,vet-diagnosis.jpg,pet-condition.jpg',
    required: false
  })
  @IsString()
  @IsOptional()
  images?: string;

  @ApiProperty({
    description: 'Bank name for direct fiat currency donations (e.g., "국민은행", "신한은행"). Donors can transfer money directly to this account.',
    example: '국민은행'
  })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({
    description: 'Bank account number for receiving donations. Ensure this is accurate to receive donor contributions.',
    example: '123-456-789012'
  })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    description: 'Account holder name. Should match the authenticated user\'s name for verification and trust.',
    example: '홍길동'
  })
  @IsString()
  @IsNotEmpty()
  accountHolder: string;
}

export class MakeDonationDto {
  @ApiProperty({
    description: 'Member ID from Spring backend database (automatically extracted from JWT token, usually not needed in request body).',
    example: 456
  })
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'Bone package item ID representing the donation amount. Get available item IDs from the bone package catalog. Each item ID corresponds to a specific number of bones (e.g., itemId 1 = 10 bones, itemId 2 = 50 bones).',
    example: 2,
    minimum: 1
  })
  @IsNumber()
  @IsNotEmpty()
  itemId: number;

  @ApiProperty({
    description: 'Donation post ID to which you want to donate. Get this from GET /api/donation/list endpoint.',
    example: 789
  })
  @IsNumber()
  @IsNotEmpty()
  donationId: number;
}

export class PreparePaymentDto {
  @ApiProperty({
    description: 'Bone package item ID to purchase. This determines how many bones you will receive and the payment amount. Get available packages from the item catalog (e.g., itemId 1 = 1000 KRW for 10 bones, itemId 2 = 5000 KRW for 50 bones).',
    example: 2,
    minimum: 1
  })
  @IsNumber()
  @IsNotEmpty()
  itemId: number;
}

export class ApprovePaymentDto {
  @ApiProperty({
    description: 'Order ID returned from POST /api/payment/prepare endpoint. This uniquely identifies the payment transaction.',
    example: 'ORDER-2025-10-26-ABC123'
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Payment key received from the payment gateway (e.g., Toss Payments, Iamport) after user completes payment. This is used to verify and finalize the transaction.',
    example: 'tviva20241026133759qLbQN'
  })
  @IsString()
  @IsNotEmpty()
  paymentKey: string;

  @ApiProperty({
    description: 'Final payment amount in KRW that was actually charged. Must match the amount from the prepare-payment response to prevent fraud.',
    example: 5000,
    minimum: 100
  })
  @IsNumber()
  @IsNotEmpty()
  finalAmount: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateDonationPostDto {
  @ApiProperty({ description: 'Member ID' })
  @IsNumber()
  @IsNotEmpty()
  memberId: number;

  @ApiProperty({ description: 'Pet ID' })
  @IsNumber()
  @IsNotEmpty()
  petId: number;

  @ApiProperty({ description: 'Donation title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Target amount' })
  @IsNumber()
  @IsNotEmpty()
  targetAmount: number;

  @ApiProperty({ description: 'Deadline (ISO format)' })
  @IsString()
  @IsNotEmpty()
  deadline: string;

  @ApiProperty({ description: 'Category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'Images URL', required: false })
  @IsString()
  @IsOptional()
  images?: string;

  @ApiProperty({ description: 'Bank name' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ description: 'Account number' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ description: 'Account holder' })
  @IsString()
  @IsNotEmpty()
  accountHolder: string;
}

export class MakeDonationDto {
  @ApiProperty({ description: 'Member ID' })
  @IsNumber()
  @IsNotEmpty()
  memberId: number;

  @ApiProperty({ description: 'Item ID (bone package)' })
  @IsNumber()
  @IsNotEmpty()
  itemId: number;

  @ApiProperty({ description: 'Donation post ID' })
  @IsNumber()
  @IsNotEmpty()
  donationId: number;
}

export class PreparePaymentDto {
  @ApiProperty({ description: 'Item ID (bone package)' })
  @IsNumber()
  @IsNotEmpty()
  itemId: number;
}

export class ApprovePaymentDto {
  @ApiProperty({ description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Payment key' })
  @IsString()
  @IsNotEmpty()
  paymentKey: string;

  @ApiProperty({ description: 'Final amount' })
  @IsNumber()
  @IsNotEmpty()
  finalAmount: number;
}

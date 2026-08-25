import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyRazorpayPaymentDto {
  @ApiProperty({ description: 'Razorpay Order ID (order_xxx)' })
  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @ApiProperty({ description: 'Razorpay Payment ID (pay_xxx)' })
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId: string;

  @ApiProperty({ description: 'Razorpay HMAC-SHA256 signature' })
  @IsString()
  @IsNotEmpty()
  razorpaySignature: string;

  @ApiPropertyOptional({ description: 'Optional payment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

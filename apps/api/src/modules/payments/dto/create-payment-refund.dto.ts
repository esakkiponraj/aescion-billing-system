import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentRefundDto {
  @ApiPropertyOptional({ description: 'Payment Attempt UUID to refund' })
  @IsOptional()
  @IsString()
  paymentAttemptId?: string;

  @ApiPropertyOptional({ description: 'Internal Payment UUID to refund' })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional({ description: 'Refund amount in INR. Defaults to maximum remaining refundable balance.' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ description: 'Reason for refund' })
  @IsOptional()
  @IsString()
  reason?: string;
}

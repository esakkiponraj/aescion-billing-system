import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRazorpayOrderDto {
  @ApiProperty({ description: 'Invoice UUID to collect payment for' })
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @ApiPropertyOptional({ description: 'Requested partial or full amount in INR. Defaults to remaining balance.' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ description: 'Optional metadata notes dictionary' })
  @IsOptional()
  @IsObject()
  notes?: Record<string, string>;
}

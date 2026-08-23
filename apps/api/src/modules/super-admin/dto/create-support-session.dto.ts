import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSupportSessionDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  reason: string; // E.g. "Ticket #1241 - Billing tax adjustment troubleshooting"

  @IsNumber()
  @IsOptional()
  durationMinutes?: number; // Default 30 mins
}

export class FeatureOverrideDto {
  @IsString()
  @IsNotEmpty()
  featureId: string;

  @IsNotEmpty()
  isEnabled: boolean;

  @IsNumber()
  @IsOptional()
  limitValue?: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

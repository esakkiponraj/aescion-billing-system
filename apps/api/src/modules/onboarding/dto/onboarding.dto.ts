import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BusinessType } from '@aescion/types';

export class OnboardingDto {
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsEnum(BusinessType)
  @IsNotEmpty()
  businessType: BusinessType;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  timezone: string;

  @IsString()
  @IsNotEmpty()
  businessSize: 'JUST_ME' | '2-10' | '11-50' | '50+';

  @IsNumber()
  @IsNotEmpty()
  outletCount: number;

  @IsString()
  @IsOptional()
  taxIdentifier?: string;

  @IsNumber()
  @IsOptional()
  defaultTaxRate?: number;

  @IsArray()
  @IsOptional()
  enabledModules?: string[];

  @IsString()
  @IsOptional()
  ownerFirstName?: string;

  @IsString()
  @IsOptional()
  ownerLastName?: string;

  @IsString()
  @IsOptional()
  ownerEmail?: string;

  @IsString()
  @IsOptional()
  ownerPassword?: string;

  @IsString()
  @IsOptional()
  ownerPhone?: string;
}

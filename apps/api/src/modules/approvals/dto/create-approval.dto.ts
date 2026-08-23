import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApprovalType, ApprovalStatus } from '@aescion/types';

export class CreateApprovalDto {
  @IsEnum(ApprovalType)
  @IsNotEmpty()
  approvalType: ApprovalType;

  @IsString()
  @IsNotEmpty()
  resourceType: string;

  @IsString()
  @IsOptional()
  resourceId?: string;

  @IsString()
  @IsNotEmpty()
  requestedValue: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  outletId?: string;
}

export class ResolveApprovalDto {
  @IsEnum(ApprovalStatus)
  @IsNotEmpty()
  status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;

  @IsString()
  @IsOptional()
  comments?: string;
}

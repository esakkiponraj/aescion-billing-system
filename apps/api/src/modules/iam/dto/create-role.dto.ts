import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RolePermissionItemDto {
  @IsString()
  @IsNotEmpty()
  permissionId: string;

  @IsString()
  @IsOptional()
  scope?: 'OWN' | 'OUTLET' | 'MULTI_OUTLET' | 'ORGANIZATION';
}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  maxDiscountPercent?: number;

  @IsBoolean()
  @IsOptional()
  priceOverrideAllowed?: boolean;

  @IsNumber()
  @IsOptional()
  approvalLimit?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionItemDto)
  permissions: RolePermissionItemDto[];
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  maxDiscountPercent?: number;

  @IsBoolean()
  @IsOptional()
  priceOverrideAllowed?: boolean;

  @IsNumber()
  @IsOptional()
  approvalLimit?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionItemDto)
  permissions?: RolePermissionItemDto[];
}

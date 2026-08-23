import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IamService } from './iam.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permissions } from '@aescion/types';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('iam')
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @RequirePermissions(Permissions.EMPLOYEES_READ)
  @Get('members')
  async getMembers(@CurrentTenant('organizationId') orgId: string) {
    return this.iamService.getMembers(orgId);
  }

  @RequirePermissions(Permissions.EMPLOYEES_MANAGE)
  @Post('invite')
  async inviteUser(
    @CurrentTenant('organizationId') orgId: string,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: InviteUserDto,
  ) {
    return this.iamService.inviteUser(orgId, dto, currentUserId);
  }

  @RequirePermissions(Permissions.EMPLOYEES_MANAGE)
  @Put('members/:membershipId')
  async updateMember(
    @CurrentTenant('organizationId') orgId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.iamService.updateMember(orgId, membershipId, dto, currentUserId);
  }

  @RequirePermissions(Permissions.ROLES_READ)
  @Get('roles')
  async getRoles(@CurrentTenant('organizationId') orgId: string) {
    return this.iamService.getRoles(orgId);
  }

  @RequirePermissions(Permissions.ROLES_READ)
  @Get('roles/:roleId')
  async getRoleById(
    @CurrentTenant('organizationId') orgId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.iamService.getRoleById(orgId, roleId);
  }

  @RequirePermissions(Permissions.ROLES_READ)
  @Get('permissions')
  async getPermissions() {
    return this.iamService.getPermissions();
  }

  @RequirePermissions(Permissions.ROLES_MANAGE)
  @Post('roles')
  async createRole(
    @CurrentTenant('organizationId') orgId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.iamService.createRole(orgId, dto);
  }

  @RequirePermissions(Permissions.ROLES_MANAGE)
  @Put('roles/:roleId')
  async updateRole(
    @CurrentTenant('organizationId') orgId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.iamService.updateRole(orgId, roleId, dto);
  }

  @RequirePermissions(Permissions.ROLES_MANAGE)
  @Delete('roles/:roleId')
  async deleteRole(
    @CurrentTenant('organizationId') orgId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.iamService.deleteRole(orgId, roleId);
  }
}


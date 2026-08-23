import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto, ResolveApprovalDto } from './dto/create-approval.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permissions } from '@aescion/types';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @RequirePermissions(Permissions.APPROVALS_READ)
  @Get()
  async getApprovals(
    @CurrentTenant('organizationId') orgId: string,
    @Query('outletId') outletId?: string,
    @Query('status') status?: string,
  ) {
    return this.approvalsService.getApprovals(orgId, outletId, status);
  }

  @Post()
  async createApproval(
    @CurrentUser('id') userId: string,
    @CurrentTenant('organizationId') orgId: string,
    @CurrentTenant('outletId') outletId: string,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.approvalsService.createApproval(userId, orgId, outletId, dto);
  }

  @RequirePermissions(Permissions.APPROVALS_DECIDE)
  @Put(':approvalId/resolve')
  async resolveApproval(
    @Param('approvalId') approvalId: string,
    @CurrentUser('id') userId: string,
    @CurrentTenant('organizationId') orgId: string,
    @Body() dto: ResolveApprovalDto,
  ) {
    return this.approvalsService.resolveApproval(approvalId, userId, orgId, dto);
  }
}

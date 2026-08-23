import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permissions } from '@aescion/types';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @RequirePermissions(Permissions.AUDIT_READ)
  @Get('logs')
  async getLogs(
    @CurrentTenant('organizationId') orgId: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getLogs(orgId, limit ? parseInt(limit, 10) : 50);
  }
}

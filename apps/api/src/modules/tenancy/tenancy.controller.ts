import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateOutletDto, CreateRegisterDto } from './dto/create-outlet.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permissions } from '@aescion/types';

@UseGuards(JwtAuthGuard)
@Controller('tenancy')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Post('organizations')
  async createOrganization(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.tenancyService.createOrganization(userId, dto);
  }

  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermissions(Permissions.ORG_READ)
  @Get('organization')
  async getActiveOrganization(@CurrentTenant('organizationId') orgId: string) {
    return this.tenancyService.getOrganizationDetails(orgId);
  }

  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermissions(Permissions.ORG_READ)
  @Get('outlets')
  async getOutlets(@CurrentTenant('organizationId') orgId: string) {
    return this.tenancyService.getOutlets(orgId);
  }

  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermissions(Permissions.OUTLET_MANAGE)
  @Post('outlets')
  async createOutlet(
    @CurrentTenant('organizationId') orgId: string,
    @Body() dto: CreateOutletDto,
  ) {
    return this.tenancyService.createOutlet(orgId, dto);
  }

  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermissions(Permissions.REGISTER_MANAGE)
  @Post('outlets/:outletId/registers')
  async createRegister(
    @Param('outletId') outletId: string,
    @Body() dto: CreateRegisterDto,
  ) {
    return this.tenancyService.createRegister(outletId, dto);
  }
}

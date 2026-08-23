import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import {
  CreateSupportSessionDto,
  FeatureOverrideDto,
} from './dto/create-support-session.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Request } from 'express';

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('stats')
  async getStats() {
    return this.superAdminService.getPlatformStats();
  }

  @Get('organizations')
  async getAllOrganizations(
    @Query('search') search?: string,
    @Query('businessType') businessType?: string,
    @Query('status') status?: string,
  ) {
    return this.superAdminService.getAllOrganizations({ search, businessType, status });
  }

  @Get('organizations/:id')
  async getOrganizationDetail(@Param('id') id: string) {
    return this.superAdminService.getOrganizationDetail(id);
  }

  @Put('organizations/:id/status')
  async updateOrganizationStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.superAdminService.updateOrganizationStatus(id, status, adminUserId);
  }

  @Put('organizations/:id/subscription')
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: { planId?: string; status?: string; extendDays?: number },
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.superAdminService.updateSubscription(id, dto, adminUserId);
  }

  @Get('subscriptions')
  async getAllSubscriptions() {
    return this.superAdminService.getAllSubscriptions();
  }

  @Get('platform-users')
  async getPlatformUsers() {
    return this.superAdminService.getPlatformUsers();
  }

  @Post('platform-users')
  async createPlatformUser(
    @Body() dto: { email: string; firstName: string; lastName: string; phone?: string; password?: string },
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.superAdminService.createPlatformUser(dto, adminUserId);
  }

  @Put('platform-users/:id')
  async updatePlatformUser(
    @Param('id') id: string,
    @Body() dto: { isActive?: boolean; firstName?: string; lastName?: string; phone?: string },
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.superAdminService.updatePlatformUser(id, dto, adminUserId);
  }

  @Get('support-issues')
  async getSupportIssues(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
  ) {
    return this.superAdminService.getSupportIssues({ status, priority, category });
  }

  @Post('support-issues')
  async createSupportIssue(
    @Body() dto: { organizationId: string; category: string; title: string; description: string; priority?: string },
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.superAdminService.createSupportIssue(dto, adminUserId);
  }

  @Put('support-issues/:id')
  async updateSupportIssue(
    @Param('id') id: string,
    @Body() dto: { status?: string; assignedToUserId?: string; internalNotes?: string; resolution?: string },
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.superAdminService.updateSupportIssue(id, dto, adminUserId);
  }

  @Get('reports')
  async getPlatformReports() {
    return this.superAdminService.getPlatformReports();
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.superAdminService.getAuditLogs({
      action,
      organizationId,
      search,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('settings')
  async getSystemSettings() {
    return this.superAdminService.getSystemSettings();
  }

  @Put('settings')
  async updateSystemSettings(
    @Body() settings: Record<string, string>,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.superAdminService.updateSystemSettings(settings, adminUserId);
  }

  @Post('support-session')
  async startSupportSession(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSupportSessionDto,
    @Req() req: Request,
  ) {
    const meta = {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
    return this.superAdminService.startSupportSession(userId, dto, meta);
  }

  @Get('plans-features')
  async getPlansAndFeatures() {
    return this.superAdminService.getPlansAndFeatures();
  }

  @Put('organizations/:orgId/features')
  async overrideFeature(
    @Param('orgId') orgId: string,
    @Body() dto: FeatureOverrideDto,
  ) {
    return this.superAdminService.overrideFeature(orgId, dto);
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateSupportSessionDto,
  FeatureOverrideDto,
} from './dto/create-support-session.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SuperAdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const totalOrganizations = await this.prisma.organization.count();
    const activeBusinesses = await this.prisma.organization.count({
      where: { status: 'ACTIVE' },
    });
    const trialBusinesses = await this.prisma.subscription.count({
      where: { status: 'TRIALING' },
    });
    const suspendedBusinesses = await this.prisma.organization.count({
      where: { status: 'SUSPENDED' },
    });

    const activeSubscriptions = await this.prisma.subscription.count({
      where: { status: 'ACTIVE' },
    });
    const expiringSubscriptions = await this.prisma.subscription.count({
      where: {
        endsAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const totalPlatformUsers = await this.prisma.user.count({
      where: { isSuperAdmin: true },
    });

    const openSupportIssues = await (this.prisma as any).supportIssue.count({
      where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
    });

    const supportSummary = {
      open: await (this.prisma as any).supportIssue.count({ where: { status: 'OPEN' } }),
      inProgress: await (this.prisma as any).supportIssue.count({ where: { status: 'IN_PROGRESS' } }),
      waitingClient: await (this.prisma as any).supportIssue.count({ where: { status: 'WAITING_CLIENT' } }),
      resolved: await (this.prisma as any).supportIssue.count({ where: { status: 'RESOLVED' } }),
      critical: await (this.prisma as any).supportIssue.count({ where: { priority: 'CRITICAL', status: { not: 'CLOSED' } } }),
    };

    const recentOrganizations = await this.prisma.organization.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        outlets: true,
        subscriptions: {
          include: {
            plan: true,
          },
        },
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });

    const recentActivity = await this.prisma.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: true,
        user: true,
      },
    });

    return {
      stats: {
        totalOrganizations,
        activeBusinesses,
        trialBusinesses,
        suspendedBusinesses,
        activeSubscriptions,
        expiringSubscriptions,
        totalPlatformUsers,
        openSupportIssues,
      },
      supportSummary,
      recentOrganizations,
      recentActivity,
    };
  }

  async getAllOrganizations(query?: {
    search?: string;
    businessType?: string;
    status?: string;
    planCode?: string;
  }) {
    const where: any = {};

    if (query?.businessType && query.businessType !== 'ALL') {
      where.businessType = query.businessType;
    }

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.organization.findMany({
      where,
      include: {
        outlets: {
          include: {
            registers: true,
          },
        },
        subscriptions: {
          include: {
            plan: true,
          },
        },
        memberships: {
          include: {
            user: true,
            membershipRoles: {
              include: {
                role: true,
              },
            },
          },
        },
        supportIssues: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrganizationDetail(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        legalEntities: true,
        outlets: {
          include: {
            registers: true,
          },
        },
        subscriptions: {
          include: {
            plan: true,
          },
        },
        memberships: {
          include: {
            user: true,
            membershipRoles: {
              include: {
                role: true,
              },
            },
            outletMemberships: {
              include: {
                outlet: true,
              },
            },
          },
        },
        featureOverrides: {
          include: {
            feature: true,
          },
        },
        supportIssues: {
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          take: 15,
          orderBy: { createdAt: 'desc' },
          include: {
            user: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return org;
  }

  async updateOrganizationStatus(orgId: string, status: string, adminUserId: string) {
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: adminUserId,
        action: `ORGANIZATION_STATUS_${status}`,
        resource: 'Organization',
        resourceId: org.id,
        afterState: JSON.stringify({ status }),
      },
    });

    return org;
  }

  async updateSubscription(
    orgId: string,
    dto: { planId?: string; status?: string; extendDays?: number },
    adminUserId: string,
  ) {
    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
    });

    if (!sub) {
      throw new NotFoundException('Subscription not found for this organization.');
    }

    let endsAt = sub.endsAt;
    if (dto.extendDays) {
      const baseDate = endsAt && endsAt > new Date() ? endsAt : new Date();
      endsAt = new Date(baseDate.getTime() + dto.extendDays * 24 * 60 * 60 * 1000);
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: dto.planId || sub.planId,
        status: dto.status || sub.status,
        endsAt,
      },
      include: { plan: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: adminUserId,
        action: 'SUBSCRIPTION_MODIFIED',
        resource: 'Subscription',
        resourceId: sub.id,
        beforeState: JSON.stringify(sub),
        afterState: JSON.stringify(updated),
      },
    });

    return updated;
  }

  async getAllSubscriptions() {
    return this.prisma.subscription.findMany({
      include: {
        organization: {
          include: {
            outlets: true,
            memberships: true,
          },
        },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlatformUsers() {
    return this.prisma.user.findMany({
      where: { isSuperAdmin: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isSuperAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createPlatformUser(dto: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    password?: string;
  }, adminUserId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      if (existing.isSuperAdmin) {
        throw new ConflictException('A platform user with this email already exists.');
      }
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { isSuperAdmin: true, isActive: true },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password || 'Admin@12345', 10);
    const newUser = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        isSuperAdmin: true,
        isActive: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'PLATFORM_USER_CREATED',
        resource: 'User',
        resourceId: newUser.id,
        afterState: JSON.stringify({ email: newUser.email, role: 'SuperAdmin' }),
      },
    });

    return newUser;
  }

  async updatePlatformUser(
    id: string,
    dto: { isActive?: boolean; firstName?: string; lastName?: string; phone?: string },
    adminUserId: string,
  ) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'PLATFORM_USER_UPDATED',
        resource: 'User',
        resourceId: id,
        afterState: JSON.stringify(dto),
      },
    });

    return updated;
  }

  async getSupportIssues(query?: { status?: string; priority?: string; category?: string }) {
    const where: any = {};
    if (query?.status && query.status !== 'ALL') where.status = query.status;
    if (query?.priority && query.priority !== 'ALL') where.priority = query.priority;
    if (query?.category && query.category !== 'ALL') where.category = query.category;

    return (this.prisma as any).supportIssue.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            businessType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupportIssue(dto: {
    organizationId: string;
    category: string;
    title: string;
    description: string;
    priority?: string;
  }, adminUserId: string) {
    const issue = await (this.prisma as any).supportIssue.create({
      data: {
        organizationId: dto.organizationId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        priority: dto.priority || 'MEDIUM',
        status: 'OPEN',
      },
      include: {
        organization: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        userId: adminUserId,
        action: 'SUPPORT_ISSUE_CREATED',
        resource: 'SupportIssue',
        resourceId: issue.id,
        afterState: JSON.stringify(issue),
      },
    });

    return issue;
  }

  async updateSupportIssue(
    id: string,
    dto: {
      status?: string;
      assignedToUserId?: string;
      internalNotes?: string;
      resolution?: string;
    },
    adminUserId: string,
  ) {
    const updated = await (this.prisma as any).supportIssue.update({
      where: { id },
      data: dto,
      include: { organization: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: updated.organizationId,
        userId: adminUserId,
        action: `SUPPORT_ISSUE_${dto.status || 'UPDATED'}`,
        resource: 'SupportIssue',
        resourceId: id,
        afterState: JSON.stringify(dto),
      },
    });

    return updated;
  }

  async getPlatformReports() {
    const totalOrgs = await this.prisma.organization.count();
    const orgs = await this.prisma.organization.findMany({
      include: {
        subscriptions: { include: { plan: true } },
        outlets: true,
        memberships: true,
      },
    });

    // Business type distribution
    const typeCounts: Record<string, number> = {};
    for (const org of orgs) {
      typeCounts[org.businessType] = (typeCounts[org.businessType] || 0) + 1;
    }

    // Plan distribution
    const planCounts: Record<string, number> = {};
    for (const org of orgs) {
      const planCode = org.subscriptions[0]?.plan?.code || 'UNASSIGNED';
      planCounts[planCode] = (planCounts[planCode] || 0) + 1;
    }

    // Subscription status breakdown
    const statusCounts: Record<string, number> = {};
    for (const org of orgs) {
      const subStatus = org.subscriptions[0]?.status || 'NO_SUB';
      statusCounts[subStatus] = (statusCounts[subStatus] || 0) + 1;
    }

    const totalOutlets = orgs.reduce((acc, o) => acc + o.outlets.length, 0);
    const totalMembers = orgs.reduce((acc, o) => acc + o.memberships.length, 0);

    const issues = await (this.prisma as any).supportIssue.findMany();
    const issuesByCategory: Record<string, number> = {};
    for (const issue of issues) {
      issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
    }

    return {
      businessGrowth: {
        totalBusinesses: totalOrgs,
        activeRate: totalOrgs > 0 ? Math.round((orgs.filter((o) => o.status === 'ACTIVE').length / totalOrgs) * 100) : 0,
        averageOutletsPerOrg: totalOrgs > 0 ? (totalOutlets / totalOrgs).toFixed(1) : 0,
        averageUsersPerOrg: totalOrgs > 0 ? (totalMembers / totalOrgs).toFixed(1) : 0,
      },
      typeDistribution: Object.entries(typeCounts).map(([type, count]) => ({ type, count })),
      planDistribution: Object.entries(planCounts).map(([plan, count]) => ({ plan, count })),
      subscriptionBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      issuesByCategory: Object.entries(issuesByCategory).map(([category, count]) => ({ category, count })),
    };
  }

  async getAuditLogs(query?: {
    action?: string;
    organizationId?: string;
    search?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (query?.action && query.action !== 'ALL') where.action = { contains: query.action };
    if (query?.organizationId && query.organizationId !== 'ALL') where.organizationId = query.organizationId;
    if (query?.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { resource: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        organization: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query?.limit || 50,
    });
  }

  async getSystemSettings() {
    const settings = await (this.prisma as any).systemSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    return settingsMap;
  }

  async updateSystemSettings(settings: Record<string, string>, adminUserId: string) {
    for (const [key, value] of Object.entries(settings)) {
      await (this.prisma as any).systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'SYSTEM_SETTINGS_UPDATED',
        resource: 'SystemSettings',
        afterState: JSON.stringify(settings),
      },
    });

    return this.getSystemSettings();
  }

  async startSupportSession(
    superAdminUserId: string,
    dto: CreateSupportSessionDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      include: { outlets: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    const duration = dto.durationMinutes || 30;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + duration);

    // Audit Log the Support Impersonation start
    await this.prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: superAdminUserId,
        action: 'SUPPORT_IMPERSONATION_STARTED',
        resource: 'Organization',
        resourceId: org.id,
        afterState: JSON.stringify({
          reason: dto.reason,
          durationMinutes: duration,
          expiresAt: expiresAt.toISOString(),
        }),
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    return {
      organizationId: org.id,
      organizationName: org.name,
      businessType: org.businessType,
      defaultOutletId: org.outlets[0]?.id || null,
      reason: dto.reason,
      expiresAt,
      durationMinutes: duration,
    };
  }

  async getPlansAndFeatures() {
    const plans = await this.prisma.plan.findMany({
      include: {
        planFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    const features = await this.prisma.feature.findMany();

    return { plans, features };
  }

  async overrideFeature(orgId: string, dto: FeatureOverrideDto) {
    return this.prisma.featureOverride.upsert({
      where: {
        organizationId_featureId: {
          organizationId: orgId,
          featureId: dto.featureId,
        },
      },
      update: {
        isEnabled: dto.isEnabled,
        limitValue: dto.limitValue,
        reason: dto.reason,
      },
      create: {
        organizationId: orgId,
        featureId: dto.featureId,
        isEnabled: dto.isEnabled,
        limitValue: dto.limitValue,
        reason: dto.reason,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async getLogs(orgId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async logAction(data: {
    organizationId?: string;
    outletId?: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    beforeState?: any;
    afterState?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: data.organizationId,
        outletId: data.outletId,
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        beforeState: data.beforeState ? JSON.stringify(data.beforeState) : null,
        afterState: data.afterState ? JSON.stringify(data.afterState) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

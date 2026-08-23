import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateApprovalDto, ResolveApprovalDto } from './dto/create-approval.dto';
import { ApprovalStatus } from '@aescion/types';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async getApprovals(orgId: string, outletId?: string, status?: string) {
    const whereClause: any = { organizationId: orgId };

    if (outletId) {
      whereClause.outletId = outletId;
    }

    if (status) {
      whereClause.status = status;
    }

    return this.prisma.approvalRequest.findMany({
      where: whereClause,
      include: {
        requestedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        decidedByUser: {
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
    });
  }

  async createApproval(
    userId: string,
    orgId: string,
    outletId: string,
    dto: CreateApprovalDto,
  ) {
    const approval = await this.prisma.approvalRequest.create({
      data: {
        organizationId: orgId,
        outletId: dto.outletId || outletId,
        requestedByUserId: userId,
        approvalType: dto.approvalType,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        requestedValue: dto.requestedValue,
        reason: dto.reason,
        status: ApprovalStatus.PENDING,
      },
      include: {
        requestedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        outletId: dto.outletId || outletId,
        userId,
        action: 'APPROVAL_REQUESTED',
        resource: 'ApprovalRequest',
        resourceId: approval.id,
        afterState: JSON.stringify(dto),
      },
    });

    return approval;
  }

  async resolveApproval(
    approvalId: string,
    decidedByUserId: string,
    orgId: string,
    dto: ResolveApprovalDto,
  ) {
    const approval = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalId, organizationId: orgId },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found.');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Approval request is already resolved with status '${approval.status}'.`,
      );
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: dto.status,
        decidedByUserId,
        decidedAt: new Date(),
        comments: dto.comments,
      },
      include: {
        requestedByUser: true,
        decidedByUser: true,
      },
    });

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        outletId: approval.outletId,
        userId: decidedByUserId,
        action: dto.status === ApprovalStatus.APPROVED ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
        resource: 'ApprovalRequest',
        resourceId: approval.id,
        beforeState: JSON.stringify({ status: approval.status }),
        afterState: JSON.stringify({ status: dto.status, comments: dto.comments }),
      },
    });

    return updated;
  }
}

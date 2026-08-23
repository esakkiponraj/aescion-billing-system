import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContext, PermissionScope, PermissionCode } from '@aescion/types';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    let targetOrgId = (request.headers['x-organization-id'] as string) || request.query?.orgId;
    let effectiveOutletId = (request.headers['x-outlet-id'] as string) || request.query?.outletId;

    // If orgId is not provided in headers/query, automatically resolve default active org membership for the user
    if (!targetOrgId && user.id) {
      const defaultMembership = await this.prisma.organizationMembership.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'asc' },
      });

      if (defaultMembership) {
        targetOrgId = defaultMembership.organizationId;
      } else if (user.isSuperAdmin) {
        // If super admin has no explicit membership, fall back to first active organization in system
        const firstOrg = await this.prisma.organization.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        });
        if (firstOrg) {
          targetOrgId = firstOrg.id;
        }
      }
    }

    if (!targetOrgId) {
      if (user.isSuperAdmin) {
        return true;
      }
      throw new ForbiddenException(
        'Organization context is required. Please provide X-Organization-Id header or select an active organization.',
      );
    }

    // Verify Organization Membership
    const orgMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        organizationId: targetOrgId,
        status: 'ACTIVE',
      },
      include: {
        organization: true,
        membershipRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        outletMemberships: {
          include: {
            outlet: true,
            membershipRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Check if user is Super Admin in support impersonation mode
    if (!orgMembership && !user.isSuperAdmin) {
      throw new ForbiddenException(
        'Access Denied: You are not an active member of this organization.',
      );
    }

    let organizationName = orgMembership?.organization?.name;
    let outletName = '';

    if (!effectiveOutletId && orgMembership?.outletMemberships?.length) {
      effectiveOutletId = orgMembership.outletMemberships[0].outletId;
      outletName = orgMembership.outletMemberships[0].outlet?.name || '';
    } else if (effectiveOutletId) {
      const targetOutlet = await this.prisma.outlet.findFirst({
        where: {
          id: effectiveOutletId,
          organizationId: targetOrgId,
          isActive: true,
        },
      });
      if (!targetOutlet) {
        throw new BadRequestException('Specified outlet does not exist or is inactive.');
      }
      outletName = targetOutlet.name;
    }

    // Aggregate roles and permissions
    const roles: string[] = [];
    const permissionMap = new Map<PermissionCode, PermissionScope>();
    let maxDiscountPercent = 0.0;
    let canOverridePrice = false;
    let approvalLimit = 0.0;

    if (orgMembership) {
      for (const mr of orgMembership.membershipRoles || []) {
        roles.push(mr.role.code);
        maxDiscountPercent = Math.max(maxDiscountPercent, mr.role.maxDiscountPercent || 0);
        canOverridePrice = canOverridePrice || mr.role.priceOverrideAllowed || false;
        approvalLimit = Math.max(approvalLimit, mr.role.approvalLimit || 0);

        for (const rp of mr.role.rolePermissions || []) {
          permissionMap.set(rp.permission.code as PermissionCode, rp.scope as PermissionScope);
        }
      }

      // Outlet specific roles
      const matchedOutletMembership = orgMembership.outletMemberships?.find(
        (om) => om.outletId === effectiveOutletId,
      );

      if (matchedOutletMembership) {
        for (const mr of matchedOutletMembership.membershipRoles || []) {
          roles.push(mr.role.code);
          maxDiscountPercent = Math.max(maxDiscountPercent, mr.role.maxDiscountPercent || 0);
          canOverridePrice = canOverridePrice || mr.role.priceOverrideAllowed || false;
          approvalLimit = Math.max(approvalLimit, mr.role.approvalLimit || 0);

          for (const rp of mr.role.rolePermissions || []) {
            permissionMap.set(rp.permission.code as PermissionCode, rp.scope as PermissionScope);
          }
        }
      }
    } else if (user.isSuperAdmin) {
      // Super Admin support impersonation defaults
      const targetOrg = await this.prisma.organization.findUnique({
        where: { id: targetOrgId },
      });
      organizationName = targetOrg?.name || 'Super Admin Active Org';
      roles.push('OWNER', 'SUPER_ADMIN_SUPPORT');
      maxDiscountPercent = 100.0;
      canOverridePrice = true;
      approvalLimit = 1000000000.0;
    }

    const permissions = Array.from(permissionMap.entries()).map(([code, scope]) => ({
      code,
      scope,
    }));

    const tenantContext: TenantContext = {
      userId: user.id,
      organizationId: targetOrgId,
      organizationName: organizationName || '',
      outletId: effectiveOutletId || '',
      outletName,
      roles,
      permissions,
      authorityLimits: {
        maxDiscountPercent,
        canOverridePrice,
        approvalLimit,
      },
      isSupportImpersonation: user.isSuperAdmin && !orgMembership,
    };

    request.tenantContext = tenantContext;
    return true;
  }
}

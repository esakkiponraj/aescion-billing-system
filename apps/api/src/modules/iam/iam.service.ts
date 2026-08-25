import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class IamService {
  constructor(private prisma: PrismaService) {}

  async getMembers(orgId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            sessions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { createdAt: true },
            },
            productAccess: {
              select: { productId: true },
            },
          },
        },
        membershipRoles: {
          include: {
            role: true,
          },
        },
        outletMemberships: {
          include: {
            outlet: true,
            membershipRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => {
      const primaryRole = m.membershipRoles[0]?.role;
      const lastLogin = m.user.sessions?.[0]?.createdAt || m.user.updatedAt || m.user.createdAt;
      return {
        membershipId: m.id,
        user: m.user,
        status: m.status,
        joinedAt: m.joinedAt,
        lastLogin,
        primaryRole: primaryRole
          ? {
              id: primaryRole.id,
              name: primaryRole.name,
              code: primaryRole.code,
              maxDiscountPercent: primaryRole.maxDiscountPercent,
              priceOverrideAllowed: primaryRole.priceOverrideAllowed,
            }
          : null,
        outlets: m.outletMemberships.map((om) => ({
          outletId: om.outlet.id,
          outletName: om.outlet.name,
          outletCode: om.outlet.code,
          role: om.membershipRoles[0]?.role?.name || primaryRole?.name || 'Member',
        })),
        assignedProductIds: m.user.productAccess.map((pa) => pa.productId),
      };
    });
  }

  async inviteUser(orgId: string, dto: InviteUserDto, currentUserId?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Password must contain at least 8 characters.');
    }

    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Check if user already exists
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ConflictException('An account with this email already exists.');
      }

      // Role check: must belong to this org or be standard system template
      const role = await tx.role.findFirst({
        where: {
          id: dto.roleId,
          OR: [{ organizationId: orgId }, { organizationId: null }],
        },
      });

      if (!role) {
        throw new NotFoundException('Role not found.');
      }

      if (role.code === 'SUPER_ADMIN') {
        throw new BadRequestException('Cannot assign platform administrator role to tenant employees.');
      }

      // Outlet check: if specified, must belong to current org
      let outletMembershipId: string | null = null;
      let assignedOutlet: any = null;
      if (dto.outletId) {
        assignedOutlet = await tx.outlet.findFirst({
          where: { id: dto.outletId, organizationId: orgId },
        });

        if (!assignedOutlet) {
          throw new BadRequestException('The selected branch is not available for this business.');
        }
      }

      // Hash password using bcrypt
      const passwordHash = await bcrypt.hash(dto.password, 10);

      // Create active user
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || null,
          isActive: true,
        },
      });

      // Create Organization Membership (ACTIVE)
      const orgMembership = await tx.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: orgId,
          status: 'ACTIVE',
        },
      });

      // Create Outlet Membership if outlet specified
      if (assignedOutlet) {
        const outletMembership = await tx.outletMembership.create({
          data: {
            orgMembershipId: orgMembership.id,
            outletId: assignedOutlet.id,
          },
        });
        outletMembershipId = outletMembership.id;
      }

      // Assign Membership Role
      await tx.membershipRole.create({
        data: {
          orgMembershipId: orgMembership.id,
          outletMembershipId,
          roleId: role.id,
        },
      });

      // Audit Log entry (never logging password or hash)
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId: assignedOutlet?.id || null,
          userId: currentUserId || null,
          action: 'EMPLOYEE_CREATED',
          resource: 'User',
          resourceId: user.id,
          afterState: JSON.stringify({
            employeeId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: role.name,
            roleCode: role.code,
            outlet: assignedOutlet?.name || 'All Outlets',
          }),
        },
      });

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        status: 'ACTIVE',
        role: {
          id: role.id,
          name: role.name,
          code: role.code,
        },
        outlet: assignedOutlet ? { id: assignedOutlet.id, name: assignedOutlet.name } : null,
      };
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async updateMember(
    orgId: string,
    membershipId: string,
    dto: UpdateMemberDto,
    currentUserId?: string,
  ) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        id: membershipId,
        organizationId: orgId,
      },
      include: {
        user: true,
        membershipRoles: true,
        outletMemberships: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Employee membership not found in your organization.');
    }

    // Role check: must belong to this org or be standard system template
    const role = await this.prisma.role.findFirst({
      where: {
        id: dto.roleId,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
    });

    if (!role) {
      throw new BadRequestException('Specified role is invalid for this organization.');
    }

    if (role.code === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot assign platform administrator role to tenant employees.');
    }

    // Outlet check: if specified, must belong to current org
    let assignedOutlet: any = null;
    if (dto.outletId) {
      assignedOutlet = await this.prisma.outlet.findFirst({
        where: { id: dto.outletId, organizationId: orgId },
      });

      if (!assignedOutlet) {
        throw new BadRequestException('Specified outlet does not belong to your organization.');
      }
    }

    // Check email uniqueness if email is changing
    const normalizedEmail = dto.email.toLowerCase().trim();
    if (normalizedEmail !== membership.user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingUser && existingUser.id !== membership.userId) {
        throw new ConflictException('A user with this email address already exists.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update user record (NO password modification)
      const updatedUser = await tx.user.update({
        where: { id: membership.userId },
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: normalizedEmail,
          phone: dto.phone?.trim() || null,
          isActive: dto.status === 'ACTIVE',
        },
      });

      // 2. Update membership status
      await tx.organizationMembership.update({
        where: { id: membershipId },
        data: {
          status: dto.status,
        },
      });

      // 3. Clear existing role and outlet assignments for this membership
      await tx.membershipRole.deleteMany({
        where: { orgMembershipId: membershipId },
      });
      await tx.outletMembership.deleteMany({
        where: { orgMembershipId: membershipId },
      });

      // 4. Create new outlet membership if outlet specified
      let outletMembershipId: string | null = null;
      if (assignedOutlet) {
        const outletMem = await tx.outletMembership.create({
          data: {
            orgMembershipId: membershipId,
            outletId: assignedOutlet.id,
          },
        });
        outletMembershipId = outletMem.id;
      }

      // 5. Assign updated role
      await tx.membershipRole.create({
        data: {
          orgMembershipId: membershipId,
          outletMembershipId,
          roleId: role.id,
        },
      });

      // 6. Record audit log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          outletId: assignedOutlet?.id || null,
          userId: currentUserId || null,
          action: 'EMPLOYEE_UPDATED',
          resource: 'User',
          resourceId: updatedUser.id,
          afterState: JSON.stringify({
            employeeId: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            role: role.name,
            roleCode: role.code,
            status: dto.status,
            outlet: assignedOutlet?.name || 'All Outlets',
          }),
        },
      });

      return {
        id: updatedUser.id,
        membershipId,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        status: dto.status,
        role: {
          id: role.id,
          name: role.name,
          code: role.code,
        },
        outlet: assignedOutlet ? { id: assignedOutlet.id, name: assignedOutlet.name } : null,
      };
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async getRoles(orgId: string) {
    return this.prisma.role.findMany({
      where: {
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            membershipRoles: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getRoleById(orgId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            membershipRoles: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    return role;
  }

  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  async createRole(orgId: string, dto: CreateRoleDto) {
    const trimmedName = dto.name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('Role Name is required.');
    }

    const roleCode = (dto.code?.trim() || trimmedName.toUpperCase().replace(/[^A-Z0-9]/g, '_'));

    // Check duplicate by name in same organization
    const existingByName = await this.prisma.role.findFirst({
      where: {
        organizationId: orgId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existingByName) {
      throw new ConflictException('A role with this name already exists.');
    }

    // Check duplicate by code in same organization
    const existingByCode = await this.prisma.role.findFirst({
      where: {
        organizationId: orgId,
        code: roleCode.toUpperCase(),
      },
    });

    if (existingByCode) {
      throw new ConflictException(`A role with code '${roleCode}' already exists.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          organizationId: orgId,
          name: trimmedName,
          code: roleCode.toUpperCase(),
          description: dto.description?.trim() || null,
          maxDiscountPercent: dto.maxDiscountPercent || 0.0,
          priceOverrideAllowed: dto.priceOverrideAllowed || false,
          approvalLimit: dto.approvalLimit || 0.0,
          isSystemDefault: false,
        },
      });

      if (dto.permissions && dto.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: dto.permissions.map((p) => ({
            roleId: role.id,
            permissionId: p.permissionId,
            scope: p.scope || 'ORGANIZATION',
          })),
        });
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              membershipRoles: true,
            },
          },
        },
      });
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async updateRole(orgId: string, roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      include: {
        rolePermissions: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found or cannot be modified.');
    }

    const isOwnerRole = role.code === 'OWNER';

    // Protect OWNER role name & code from accidental rename to non-owner
    const updatedName = isOwnerRole ? role.name : (dto.name?.trim() || role.name);

    return this.prisma.$transaction(async (tx) => {
      // If updating a global template with organizationId === null, clone it to this org first
      let targetRoleId = roleId;
      if (!role.organizationId) {
        const cloned = await tx.role.create({
          data: {
            organizationId: orgId,
            name: dto.name?.trim() || role.name,
            code: role.code,
            description: dto.description?.trim() || role.description,
            maxDiscountPercent: dto.maxDiscountPercent !== undefined ? dto.maxDiscountPercent : role.maxDiscountPercent,
            priceOverrideAllowed: dto.priceOverrideAllowed !== undefined ? dto.priceOverrideAllowed : role.priceOverrideAllowed,
            approvalLimit: dto.approvalLimit !== undefined ? dto.approvalLimit : role.approvalLimit,
            isSystemDefault: false,
          },
        });
        targetRoleId = cloned.id;
      } else {
        await tx.role.update({
          where: { id: targetRoleId },
          data: {
            name: updatedName,
            description: dto.description !== undefined ? dto.description.trim() : role.description,
            maxDiscountPercent: dto.maxDiscountPercent !== undefined ? dto.maxDiscountPercent : role.maxDiscountPercent,
            priceOverrideAllowed: dto.priceOverrideAllowed !== undefined ? dto.priceOverrideAllowed : role.priceOverrideAllowed,
            approvalLimit: dto.approvalLimit !== undefined ? dto.approvalLimit : role.approvalLimit,
          },
        });
      }

      if (dto.permissions) {
        await tx.rolePermission.deleteMany({
          where: { roleId: targetRoleId },
        });

        // Ensure Owner role retains all permissions if Owner is edited
        let finalPermissions = dto.permissions;
        if (isOwnerRole) {
          const allPermissions = await tx.permission.findMany();
          finalPermissions = allPermissions.map((p) => ({
            permissionId: p.id,
            scope: 'ORGANIZATION',
          }));
        }

        if (finalPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: finalPermissions.map((p) => ({
              roleId: targetRoleId,
              permissionId: p.permissionId,
              scope: p.scope || 'ORGANIZATION',
            })),
          });
        }
      }

      return tx.role.findUnique({
        where: { id: targetRoleId },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              membershipRoles: true,
            },
          },
        },
      });
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });
  }

  async deleteRole(orgId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      include: {
        membershipRoles: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found or cannot be deleted.');
    }

    if (role.code === 'OWNER') {
      throw new BadRequestException('The Business Owner role is protected and cannot be deleted.');
    }

    if (role.membershipRoles && role.membershipRoles.length > 0) {
      throw new BadRequestException(
        `Cannot delete role '${role.name}': There are ${role.membershipRoles.length} team member(s) currently assigned to this role. Please reassign them to another role first.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      await tx.role.delete({
        where: { id: roleId },
      });
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });

    return {
      success: true,
      message: `Role '${role.name}' deleted successfully.`,
    };
  }
}

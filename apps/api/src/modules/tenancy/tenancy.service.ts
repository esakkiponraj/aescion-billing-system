import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateOutletDto, CreateRegisterDto } from './dto/create-outlet.dto';
import { SystemRoleCode } from '@aescion/types';

@Injectable()
export class TenancyService {
  constructor(private prisma: PrismaService) {}

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          businessType: dto.businessType,
          country: dto.country || 'IN',
          currency: dto.currency || 'INR',
          timezone: dto.timezone || 'Asia/Kolkata',
          status: 'ACTIVE',
        },
      });

      // 2. Create Legal Entity
      const legalEntity = await tx.legalEntity.create({
        data: {
          organizationId: org.id,
          name: `${dto.name} Enterprise`,
        },
      });

      // 3. Create Default Outlet
      const defaultOutlet = await tx.outlet.create({
        data: {
          organizationId: org.id,
          legalEntityId: legalEntity.id,
          name: 'Main Branch',
          code: 'MAIN',
        },
      });

      // 4. Create Default Register
      await tx.register.create({
        data: {
          outletId: defaultOutlet.id,
          name: 'Register #1',
          code: 'REG-01',
        },
      });

      // 5. Fetch or create system default Owner role
      let ownerRole = await tx.role.findFirst({
        where: {
          organizationId: org.id,
          code: SystemRoleCode.OWNER,
        },
      });

      if (!ownerRole) {
        ownerRole = await tx.role.create({
          data: {
            organizationId: org.id,
            name: 'Business Owner',
            code: SystemRoleCode.OWNER,
            description: 'Full administrative control across all outlets and organization settings',
            isSystemDefault: true,
            maxDiscountPercent: 100.0,
            priceOverrideAllowed: true,
            approvalLimit: 1000000.0,
          },
        });

        // Attach all existing permissions to Owner role
        const allPermissions = await tx.permission.findMany();
        if (allPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: allPermissions.map((perm) => ({
              roleId: ownerRole.id,
              permissionId: perm.id,
              scope: 'ORGANIZATION',
            })),
          });
        }
      }

      // 6. Create Organization Membership for User
      const orgMembership = await tx.organizationMembership.create({
        data: {
          userId,
          organizationId: org.id,
          status: 'ACTIVE',
        },
      });

      // 7. Create Outlet Membership
      const outletMembership = await tx.outletMembership.create({
        data: {
          orgMembershipId: orgMembership.id,
          outletId: defaultOutlet.id,
        },
      });

      // 8. Assign Owner Role to user's memberships
      await tx.membershipRole.create({
        data: {
          orgMembershipId: orgMembership.id,
          outletMembershipId: outletMembership.id,
          roleId: ownerRole.id,
        },
      });

      // 9. Assign default plan subscription
      const starterPlan = await tx.plan.findFirst({ where: { code: 'GROWTH' } });
      if (starterPlan) {
        await tx.subscription.create({
          data: {
            organizationId: org.id,
            planId: starterPlan.id,
            status: 'ACTIVE',
          },
        });
      }

      return {
        organization: org,
        outlet: defaultOutlet,
      };
    });
  }

  async getOrganizationDetails(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
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
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return org;
  }

  async getOutlets(orgId: string) {
    return this.prisma.outlet.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        registers: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createOutlet(orgId: string, dto: CreateOutletDto) {
    const existing = await this.prisma.outlet.findFirst({
      where: {
        organizationId: orgId,
        code: dto.code.toUpperCase(),
      },
    });

    if (existing) {
      throw new ConflictException(`An outlet with code '${dto.code}' already exists.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.create({
        data: {
          organizationId: orgId,
          legalEntityId: dto.legalEntityId,
          name: dto.name,
          code: dto.code.toUpperCase(),
          address: dto.address,
          phone: dto.phone,
        },
      });

      // Create default register for new outlet
      await tx.register.create({
        data: {
          outletId: outlet.id,
          name: 'Register #1',
          code: 'REG-01',
        },
      });

      return outlet;
    });
  }

  async createRegister(outletId: string, dto: CreateRegisterDto) {
    const existing = await this.prisma.register.findFirst({
      where: {
        outletId,
        code: dto.code.toUpperCase(),
      },
    });

    if (existing) {
      throw new ConflictException(`A register with code '${dto.code}' already exists.`);
    }

    return this.prisma.register.create({
      data: {
        outletId,
        name: dto.name,
        code: dto.code.toUpperCase(),
      },
    });
  }
}

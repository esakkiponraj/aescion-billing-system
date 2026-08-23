import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { SystemRoleCode } from '@aescion/types';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async registerBusiness(
    dto: OnboardingDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (!dto.ownerEmail || !dto.ownerPassword) {
      throw new BadRequestException('Owner email and password are required for business registration.');
    }

    const email = dto.ownerEmail.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const existingMembership = await this.prisma.organizationMembership.findFirst({
        where: { userId: user.id },
      });
      if (existingMembership) {
        throw new BadRequestException('An account with this email already exists. Please log in first to manage your businesses.');
      }
    } else {
      const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.ownerFirstName?.trim() || 'Business',
          lastName: dto.ownerLastName?.trim() || 'Owner',
          phone: dto.ownerPhone?.trim() || null,
          isSuperAdmin: false,
          isActive: true,
        },
      });
    }

    const onboardingResult = await this.completeOnboarding(user.id, dto);
    const authSession = await this.authService.generateAuthResponse(user, meta);

    return {
      ...authSession,
      ...onboardingResult,
    };
  }

  async completeOnboarding(userId: string, dto: OnboardingDto) {
    const slug =
      dto.businessName.toLowerCase().replace(/[^a-z0-9]/g, '-') +
      '-' +
      Math.floor(100 + Math.random() * 900);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: dto.businessName,
          slug,
          businessType: dto.businessType,
          country: dto.country,
          currency: dto.currency,
          timezone: dto.timezone,
          status: 'ACTIVE',
        },
      });

      // 2. Create Legal Entity with Tax Config
      const legalEntity = await tx.legalEntity.create({
        data: {
          organizationId: org.id,
          name: `${dto.businessName} Commercials`,
          taxNumber: dto.taxIdentifier || null,
        },
      });

      // 3. Create Default Outlets
      const outletsCreated = [];
      const branchCount = Math.max(1, dto.outletCount || 1);

      for (let i = 1; i <= branchCount; i++) {
        const outletName =
          branchCount === 1
            ? 'Main Store'
            : i === 1
              ? 'Flagship Branch'
              : `Branch #${i}`;
        const outletCode = branchCount === 1 ? 'MAIN' : `BR-${i.toString().padStart(2, '0')}`;

        const outlet = await tx.outlet.create({
          data: {
            organizationId: org.id,
            legalEntityId: legalEntity.id,
            name: outletName,
            code: outletCode,
          },
        });

        // Create default register per outlet
        await tx.register.create({
          data: {
            outletId: outlet.id,
            name: 'Register #01',
            code: 'REG-01',
          },
        });

        outletsCreated.push(outlet);
      }

      // 4. Create Standard System Roles for this Organization
      const allPermissions = await tx.permission.findMany();

      // 4.1 Owner Role (Full Org scope, unlimited authority)
      const ownerRole = await tx.role.create({
        data: {
          organizationId: org.id,
          name: 'Business Owner',
          code: SystemRoleCode.OWNER,
          description: 'Full administrative and financial authority across all branches',
          isSystemDefault: true,
          maxDiscountPercent: 100.0,
          priceOverrideAllowed: true,
          approvalLimit: 10000000.0,
        },
      });

      await tx.rolePermission.createMany({
        data: allPermissions.map((p) => ({
          roleId: ownerRole.id,
          permissionId: p.id,
          scope: 'ORGANIZATION',
        })),
      });

      // 4.2 Manager Role (Outlet scope, 20% discount, price override)
      const managerRole = await tx.role.create({
        data: {
          organizationId: org.id,
          name: 'Store Manager',
          code: SystemRoleCode.MANAGER,
          description: 'Branch operational control, staff monitoring, and approvals',
          isSystemDefault: true,
          maxDiscountPercent: 20.0,
          priceOverrideAllowed: true,
          approvalLimit: 50000.0,
        },
      });

      const managerPerms = allPermissions.filter((p) => !p.code.includes('org.update') && !p.code.includes('reports.profit'));
      await tx.rolePermission.createMany({
        data: managerPerms.map((p) => ({
          roleId: managerRole.id,
          permissionId: p.id,
          scope: 'OUTLET',
        })),
      });

      // 4.3 Cashier Role (Fast billing, 5% discount, requires approvals for refunds)
      const cashierRole = await tx.role.create({
        data: {
          organizationId: org.id,
          name: 'Counter Cashier',
          code: SystemRoleCode.CASHIER,
          description: 'High-velocity POS billing, receipt generation, and shift register',
          isSystemDefault: true,
          maxDiscountPercent: 5.0,
          priceOverrideAllowed: false,
          approvalLimit: 1000.0,
        },
      });

      const cashierTargetCodes = new Set([
        'pos.access',
        'sales.read',
        'sales.create',
        'sales.discount',
        'sales.cancel',
        'sales.refund',
        'sales.price_override',
        'sales.invoice.read',
        'sales.invoice.export',
        'products.read',
        'payment.create',
        'payment.read',
        'cash.read',
        'customers.read',
      ]);
      const cashierPerms = allPermissions.filter((p) => cashierTargetCodes.has(p.code));
      await tx.rolePermission.createMany({
        data: cashierPerms.map((p) => ({
          roleId: cashierRole.id,
          permissionId: p.id,
          scope: 'OUTLET',
        })),
      });

      // 4.4 Accountant Role (Financials, expenses, reports, taxes)
      const accountantRole = await tx.role.create({
        data: {
          organizationId: org.id,
          name: 'Accountant',
          code: SystemRoleCode.ACCOUNTANT,
          description: 'Tax filing, purchase invoices, ledger auditing, and reports',
          isSystemDefault: true,
          maxDiscountPercent: 0.0,
          priceOverrideAllowed: false,
          approvalLimit: 0.0,
        },
      });

      const accountantPerms = allPermissions.filter(
        (p) =>
          p.code.includes('reports') ||
          p.code.includes('expenses') ||
          p.code.includes('taxes') ||
          p.code.includes('audit') ||
          p.code === 'purchase.read' ||
          p.code === 'sales.read' ||
          p.code === 'inventory.read',
      );
      await tx.rolePermission.createMany({
        data: accountantPerms.map((p) => ({
          roleId: accountantRole.id,
          permissionId: p.id,
          scope: 'ORGANIZATION',
        })),
      });

      // 5. Create Organization Membership for Owner
      const orgMembership = await tx.organizationMembership.create({
        data: {
          userId,
          organizationId: org.id,
          status: 'ACTIVE',
        },
      });

      // 6. Assign Owner to primary outlet
      const primaryOutlet = outletsCreated[0];
      const outletMembership = await tx.outletMembership.create({
        data: {
          orgMembershipId: orgMembership.id,
          outletId: primaryOutlet.id,
        },
      });

      // 7. Assign Owner role
      await tx.membershipRole.create({
        data: {
          orgMembershipId: orgMembership.id,
          outletMembershipId: outletMembership.id,
          roleId: ownerRole.id,
        },
      });

      // 8. Assign Initial Subscription Plan
      const targetPlanCode = dto.outletCount > 1 ? 'GROWTH' : 'STARTER';
      let plan = await tx.plan.findFirst({ where: { code: targetPlanCode } });
      if (!plan) {
        plan = await tx.plan.create({
          data: {
            name: targetPlanCode === 'GROWTH' ? 'Growth Business' : 'Starter Single-Shop',
            code: targetPlanCode,
            maxOutlets: targetPlanCode === 'GROWTH' ? 5 : 1,
            maxUsers: targetPlanCode === 'GROWTH' ? 10 : 3,
            maxRegisters: targetPlanCode === 'GROWTH' ? 5 : 1,
          },
        });
      }

      await tx.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: 'ACTIVE',
        },
      });

      // 9. Create Audit Log Entry
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          outletId: primaryOutlet.id,
          userId,
          action: 'ONBOARDING_COMPLETED',
          resource: 'Organization',
          resourceId: org.id,
          afterState: JSON.stringify({
            name: org.name,
            businessType: org.businessType,
            country: org.country,
            currency: org.currency,
            outletsCount: outletsCreated.length,
          }),
        },
      });

      return {
        message: 'Onboarding completed successfully.',
        organization: org,
        primaryOutlet,
        outlets: outletsCreated,
      };
    });
  }
}

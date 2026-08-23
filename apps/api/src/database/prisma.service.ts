import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SYSTEM_PERMISSIONS } from '../common/constants/permissions.constant';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to Database via Prisma Client');
    await this.syncSystemPermissionsAndRoles();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from Database');
  }

  async syncSystemPermissionsAndRoles() {
    try {
      this.logger.log('Syncing System Permissions and Organization Default Roles...');

      // 1. Upsert all system permissions
      for (const perm of SYSTEM_PERMISSIONS) {
        await this.permission.upsert({
          where: { code: perm.code },
          update: { description: perm.description, module: perm.module },
          create: {
            code: perm.code,
            module: perm.module,
            description: perm.description,
          },
        });
      }

      const allPermissions = await this.permission.findMany();
      const allOrgs = await this.organization.findMany();

      for (const org of allOrgs) {
        // --- 1. OWNER Role ---
        let ownerRole = await this.role.findFirst({
          where: { organizationId: org.id, code: 'OWNER' },
        });
        if (!ownerRole) {
          ownerRole = await this.role.create({
            data: {
              organizationId: org.id,
              name: 'Business Owner',
              code: 'OWNER',
              description: 'Full administrative control across all outlets and organization settings',
              isSystemDefault: true,
              maxDiscountPercent: 100.0,
              priceOverrideAllowed: true,
              approvalLimit: 10000000.0,
            },
          });
        }
        const existingOwnerPerms = await this.rolePermission.findMany({
          where: { roleId: ownerRole.id },
        });
        if (existingOwnerPerms.length < allPermissions.length) {
          const existingPermIds = new Set(existingOwnerPerms.map((rp) => rp.permissionId));
          const missingPerms = allPermissions.filter((p) => !existingPermIds.has(p.id));
          if (missingPerms.length > 0) {
            await this.rolePermission.createMany({
              data: missingPerms.map((p) => ({
                roleId: ownerRole!.id,
                permissionId: p.id,
                scope: 'ORGANIZATION',
              })),
            });
          }
        }

        // --- 2. CASHIER Role ---
        let cashierRole = await this.role.findFirst({
          where: { organizationId: org.id, code: 'CASHIER' },
        });
        if (!cashierRole) {
          cashierRole = await this.role.create({
            data: {
              organizationId: org.id,
              name: 'Counter Cashier',
              code: 'CASHIER',
              description: 'High-velocity POS billing, receipt generation, and shift register',
              isSystemDefault: true,
              maxDiscountPercent: 5.0,
              priceOverrideAllowed: false,
              approvalLimit: 1000.0,
            },
          });
        }
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
        const existingCashierPerms = await this.rolePermission.findMany({
          where: { roleId: cashierRole.id },
        });
        const existingCashierPermIds = new Set(existingCashierPerms.map((rp) => rp.permissionId));
        const missingCashierPerms = cashierPerms.filter((p) => !existingCashierPermIds.has(p.id));
        if (missingCashierPerms.length > 0) {
          await this.rolePermission.createMany({
            data: missingCashierPerms.map((p) => ({
              roleId: cashierRole!.id,
              permissionId: p.id,
              scope: 'OUTLET',
            })),
          });
        }

        // --- 3. MANAGER Role ---
        let managerRole = await this.role.findFirst({
          where: { organizationId: org.id, code: 'MANAGER' },
        });
        if (!managerRole) {
          managerRole = await this.role.create({
            data: {
              organizationId: org.id,
              name: 'Store Manager',
              code: 'MANAGER',
              description: 'Branch operational control, staff monitoring, and approvals',
              isSystemDefault: true,
              maxDiscountPercent: 20.0,
              priceOverrideAllowed: true,
              approvalLimit: 50000.0,
            },
          });
        }
        const managerPerms = allPermissions.filter(
          (p) => !p.code.includes('org.update') && !p.code.includes('reports.profit'),
        );
        const existingMgrPerms = await this.rolePermission.findMany({
          where: { roleId: managerRole.id },
        });
        const existingMgrPermIds = new Set(existingMgrPerms.map((rp) => rp.permissionId));
        const missingMgrPerms = managerPerms.filter((p) => !existingMgrPermIds.has(p.id));
        if (missingMgrPerms.length > 0) {
          await this.rolePermission.createMany({
            data: missingMgrPerms.map((p) => ({
              roleId: managerRole!.id,
              permissionId: p.id,
              scope: 'OUTLET',
            })),
          });
        }

        // --- 4. ACCOUNTANT Role ---
        let accountantRole = await this.role.findFirst({
          where: { organizationId: org.id, code: 'ACCOUNTANT' },
        });
        if (!accountantRole) {
          accountantRole = await this.role.create({
            data: {
              organizationId: org.id,
              name: 'Accountant',
              code: 'ACCOUNTANT',
              description: 'Tax filing, purchase invoices, ledger auditing, and reports',
              isSystemDefault: true,
              maxDiscountPercent: 0.0,
              priceOverrideAllowed: false,
              approvalLimit: 0.0,
            },
          });
        }
        const accountantPerms = allPermissions.filter(
          (p) =>
            p.code.includes('reports') ||
            p.code.includes('expenses') ||
            p.code.includes('taxes') ||
            p.code.includes('audit') ||
            p.code.includes('finance.') ||
            p.code.includes('.read') ||
            p.code.includes('.export') ||
            p.code === 'payment.create' ||
            p.code === 'expense.create' ||
            p.code === 'expense.update' ||
            p.code === 'products.read',
        );
        const existingAcctPerms = await this.rolePermission.findMany({
          where: { roleId: accountantRole.id },
        });
        const existingAcctPermIds = new Set(existingAcctPerms.map((rp) => rp.permissionId));
        const missingAcctPerms = accountantPerms.filter((p) => !existingAcctPermIds.has(p.id));
        if (missingAcctPerms.length > 0) {
          await this.rolePermission.createMany({
            data: missingAcctPerms.map((p) => ({
              roleId: accountantRole!.id,
              permissionId: p.id,
              scope: 'ORGANIZATION',
            })),
          });
        }
      }

      this.logger.log('System Permissions and Organization Default Roles synced successfully.');
    } catch (err) {
      this.logger.error('Failed to sync system permissions and roles:', err);
    }
  }
}

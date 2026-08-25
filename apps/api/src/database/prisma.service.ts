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

      // 1. Bulk sync system permissions in a single query
      const existingPermissions = await this.permission.findMany({
        select: { id: true, code: true },
      });
      const existingCodeMap = new Map(existingPermissions.map((p) => [p.code, p.id]));

      const missingPermissions = SYSTEM_PERMISSIONS.filter((p) => !existingCodeMap.has(p.code));
      if (missingPermissions.length > 0) {
        await this.permission.createMany({
          data: missingPermissions.map((p) => ({
            code: p.code,
            module: p.module,
            description: p.description,
          })),
          skipDuplicates: true,
        });
      }

      // Re-fetch permissions if missing ones were inserted
      const allPermissions =
        missingPermissions.length > 0 ? await this.permission.findMany() : await this.permission.findMany();

      // 2. Fetch all organizations with their existing roles & role permissions in one query
      const allOrgs = await this.organization.findMany({
        include: {
          roles: {
            include: {
              rolePermissions: { select: { permissionId: true } },
            },
          },
        },
      });

      for (const org of allOrgs) {
        const orgRoles = org.roles || [];

        // --- 1. OWNER Role ---
        let ownerRole = orgRoles.find((r) => r.code === 'OWNER');
        if (!ownerRole) {
          ownerRole = (await this.role.create({
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
            include: { rolePermissions: true },
          })) as any;
        }
        const existingOwnerPermIds = new Set((ownerRole.rolePermissions || []).map((rp: any) => rp.permissionId));
        const missingOwnerPerms = allPermissions.filter((p) => !existingOwnerPermIds.has(p.id));
        if (missingOwnerPerms.length > 0) {
          await this.rolePermission.createMany({
            data: missingOwnerPerms.map((p) => ({
              roleId: ownerRole!.id,
              permissionId: p.id,
              scope: 'ORGANIZATION',
            })),
            skipDuplicates: true,
          });
        }

        // --- 2. CASHIER Role ---
        let cashierRole = orgRoles.find((r) => r.code === 'CASHIER');
        if (!cashierRole) {
          cashierRole = (await this.role.create({
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
            include: { rolePermissions: true },
          })) as any;
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
        const existingCashierPermIds = new Set((cashierRole.rolePermissions || []).map((rp: any) => rp.permissionId));
        const missingCashierPerms = cashierPerms.filter((p) => !existingCashierPermIds.has(p.id));
        if (missingCashierPerms.length > 0) {
          await this.rolePermission.createMany({
            data: missingCashierPerms.map((p) => ({
              roleId: cashierRole!.id,
              permissionId: p.id,
              scope: 'OUTLET',
            })),
            skipDuplicates: true,
          });
        }

        // --- 3. MANAGER Role ---
        let managerRole = orgRoles.find((r) => r.code === 'MANAGER');
        if (!managerRole) {
          managerRole = (await this.role.create({
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
            include: { rolePermissions: true },
          })) as any;
        }
        const managerPerms = allPermissions.filter(
          (p) => !p.code.includes('org.update') && !p.code.includes('reports.profit'),
        );
        const existingMgrPermIds = new Set((managerRole.rolePermissions || []).map((rp: any) => rp.permissionId));
        const missingMgrPerms = managerPerms.filter((p) => !existingMgrPermIds.has(p.id));
        if (missingMgrPerms.length > 0) {
          await this.rolePermission.createMany({
            data: missingMgrPerms.map((p) => ({
              roleId: managerRole!.id,
              permissionId: p.id,
              scope: 'OUTLET',
            })),
            skipDuplicates: true,
          });
        }

        // --- 4. ACCOUNTANT Role ---
        let accountantRole = orgRoles.find((r) => r.code === 'ACCOUNTANT');
        if (!accountantRole) {
          accountantRole = (await this.role.create({
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
            include: { rolePermissions: true },
          })) as any;
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
        const existingAcctPermIds = new Set((accountantRole.rolePermissions || []).map((rp: any) => rp.permissionId));
        const missingAcctPerms = accountantPerms.filter((p) => !existingAcctPermIds.has(p.id));
        if (missingAcctPerms.length > 0) {
          await this.rolePermission.createMany({
            data: missingAcctPerms.map((p) => ({
              roleId: accountantRole!.id,
              permissionId: p.id,
              scope: 'ORGANIZATION',
            })),
            skipDuplicates: true,
          });
        }
      }

      this.logger.log('System Permissions and Organization Default Roles synced successfully.');
    } catch (err) {
      this.logger.error('Failed to sync system permissions and roles:', err);
    }
  }
}

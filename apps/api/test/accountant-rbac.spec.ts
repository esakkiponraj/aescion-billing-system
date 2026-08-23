import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { SuperAdminGuard } from '../src/common/guards/super-admin.guard';
import { Permissions } from '@aescion/types';

describe('Accountant RBAC & Security Boundary Specifications', () => {
  let permissionsGuard: PermissionsGuard;
  let superAdminGuard: SuperAdminGuard;
  let reflector: Reflector;

  const mockAccountantContext = {
    userId: 'acct-user-1',
    organizationId: 'org-nova-supermarket',
    outletId: 'outlet-tenkasi',
    organizationName: 'Nova Supermarket',
    outletName: 'Tenkasi Branch',
    roles: ['ACCOUNTANT'],
    permissions: [
      { code: Permissions.REPORTS_SALES_READ, scope: 'ORGANIZATION' },
      { code: Permissions.REPORTS_PROFIT_READ, scope: 'ORGANIZATION' },
      { code: Permissions.SALES_READ, scope: 'ORGANIZATION' },
      { code: Permissions.PURCHASE_READ, scope: 'ORGANIZATION' },
      { code: Permissions.EXPENSES_MANAGE, scope: 'ORGANIZATION' },
      { code: Permissions.TAXES_MANAGE, scope: 'ORGANIZATION' },
    ],
    authorityLimits: {
      maxDiscountPercent: 0,
      canOverridePrice: false,
      approvalLimit: 0,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsGuard, SuperAdminGuard, Reflector],
    }).compile();

    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
    superAdminGuard = module.get<SuperAdminGuard>(SuperAdminGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Authorized Financial Operations', () => {
    it('should allow Accountant to access financial dashboard reports (reports.sales.read)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'permissions') return [Permissions.REPORTS_SALES_READ];
        return false;
      });

      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'acct-user-1', isSuperAdmin: false },
            tenantContext: mockAccountantContext,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(permissionsGuard.canActivate(mockExecutionContext)).toBe(true);
    });

    it('should allow Accountant to inspect sales invoices and taxes (sales.read, taxes.manage)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'permissions') return [Permissions.SALES_READ, Permissions.TAXES_MANAGE];
        return false;
      });

      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'acct-user-1', isSuperAdmin: false },
            tenantContext: mockAccountantContext,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(permissionsGuard.canActivate(mockExecutionContext)).toBe(true);
    });

    it('should allow Accountant to view supplier purchase bills and manage expenses (purchase.read, expenses.manage)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'permissions') return [Permissions.PURCHASE_READ, Permissions.EXPENSES_MANAGE];
        return false;
      });

      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'acct-user-1', isSuperAdmin: false },
            tenantContext: mockAccountantContext,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(permissionsGuard.canActivate(mockExecutionContext)).toBe(true);
    });
  });

  describe('Unauthorized Cashier & Retail Operations (Forbidden)', () => {
    it('should block Accountant from creating POS sales (sales.create)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'permissions') return [Permissions.SALES_CREATE];
        return false;
      });

      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'acct-user-1', isSuperAdmin: false },
            tenantContext: mockAccountantContext,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => permissionsGuard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should block Accountant from retail refunds and cancellations (sales.refund, sales.cancel)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'permissions') return [Permissions.SALES_REFUND];
        return false;
      });

      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'acct-user-1', isSuperAdmin: false },
            tenantContext: mockAccountantContext,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => permissionsGuard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should block Accountant from manual inventory stock adjustments (inventory.adjust)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'permissions') return [Permissions.INVENTORY_ADJUST];
        return false;
      });

      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'acct-user-1', isSuperAdmin: false },
            tenantContext: mockAccountantContext,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => permissionsGuard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });
  });

  describe('Unauthorized System & Administrative Operations (Forbidden)', () => {
    it('should block Accountant from managing employees (employees.manage)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'permissions') return [Permissions.EMPLOYEES_MANAGE];
        return false;
      });

      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'acct-user-1', isSuperAdmin: false },
            tenantContext: mockAccountantContext,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => permissionsGuard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should block Accountant from Super Admin platform access (SuperAdminGuard)', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'acct-user-1', isSuperAdmin: false },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => superAdminGuard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });
  });
});

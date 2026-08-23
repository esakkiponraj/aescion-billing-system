import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { Permissions } from '@aescion/types';

describe('RBAC & Permission Guards', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow Cashier to access sales.create endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'permissions') return [Permissions.SALES_CREATE];
      return false;
    });

    const mockExecutionContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'cashier-1', isSuperAdmin: false },
          tenantContext: {
            organizationId: 'org-1',
            roles: ['CASHIER'],
            permissions: [{ code: Permissions.SALES_CREATE, scope: 'OUTLET' }],
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockExecutionContext)).toBe(true);
  });

  it('should block Cashier from accessing manager-only roles.manage endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'permissions') return [Permissions.ROLES_MANAGE];
      return false;
    });

    const mockExecutionContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'cashier-1', isSuperAdmin: false },
          tenantContext: {
            organizationId: 'org-1',
            roles: ['CASHIER'],
            permissions: [{ code: Permissions.SALES_CREATE, scope: 'OUTLET' }],
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(mockExecutionContext)).toThrow(
      ForbiddenException,
    );
  });

  it('should allow Owner role to bypass permission checks with organization-wide authority', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'permissions') return [Permissions.ROLES_MANAGE, Permissions.AUDIT_READ];
      return false;
    });

    const mockExecutionContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'owner-1', isSuperAdmin: false },
          tenantContext: {
            organizationId: 'org-1',
            roles: ['OWNER'],
            permissions: [],
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockExecutionContext)).toBe(true);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantGuard } from '../src/common/guards/tenant.guard';
import { PrismaService } from '../src/database/prisma.service';

describe('Multi-Tenant Isolation Guard', () => {
  let guard: TenantGuard;
  let prismaService: PrismaService;

  const mockPrismaService = {
    organizationMembership: {
      findFirst: jest.fn(),
    },
    outlet: {
      findFirst: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        Reflector,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get<TenantGuard>(TenantGuard);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should deny access if user does not belong to the requested organization', async () => {
    // User from Org A attempting to access Org B
    mockPrismaService.organizationMembership.findFirst.mockResolvedValue(null);

    const mockExecutionContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-org-a-123', isSuperAdmin: false },
          headers: { 'x-organization-id': 'org-b-456' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should grant access and attach verified tenant context if membership exists', async () => {
    const mockOrgMembership = {
      id: 'membership-123',
      userId: 'user-org-a-123',
      organizationId: 'org-a-123',
      status: 'ACTIVE',
      organization: { id: 'org-a-123', name: 'Org A Supermarket' },
      membershipRoles: [
        {
          role: {
            code: 'OWNER',
            maxDiscountPercent: 100,
            priceOverrideAllowed: true,
            approvalLimit: 1000000,
            rolePermissions: [
              {
                permission: { code: 'sales.create' },
                scope: 'ORGANIZATION',
              },
            ],
          },
        },
      ],
      outletMemberships: [
        {
          outletId: 'outlet-1',
          outlet: { name: 'Main Outlet' },
          membershipRoles: [],
        },
      ],
    };

    mockPrismaService.organizationMembership.findFirst.mockResolvedValue(mockOrgMembership);

    const mockRequest: any = {
      user: { id: 'user-org-a-123', isSuperAdmin: false },
      headers: { 'x-organization-id': 'org-a-123' },
    };

    const mockExecutionContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
    expect(mockRequest.tenantContext).toBeDefined();
    expect(mockRequest.tenantContext.organizationId).toBe('org-a-123');
    expect(mockRequest.tenantContext.roles).toContain('OWNER');
  });
});

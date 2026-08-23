import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { IamService } from '../src/modules/iam/iam.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

describe('Direct Employee Creation & Authentication Specifications', () => {
  let iamService: IamService;
  let authService: AuthService;

  const mockOrgId = 'org-nova-supermarket-1';
  const mockOutletId = 'outlet-tenkasi-1';
  const mockOwnerId = 'owner-priya-1';
  const mockRoleId = 'role-cashier-1';

  let mockCreatedUser: any = null;
  let mockMembership: any = null;
  let mockOutletMembership: any = null;
  let mockAuditLog: any = null;

  const mockPrismaService = {
    $transaction: jest.fn(async (cb) => {
      return cb(mockPrismaService);
    }),
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
    },
    outlet: {
      findFirst: jest.fn(),
    },
    organizationMembership: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    outletMembership: {
      create: jest.fn(),
    },
    membershipRole: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal: string) => defaultVal),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IamService,
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    iamService = module.get<IamService>(IamService);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCreatedUser = null;
    mockMembership = null;
    mockOutletMembership = null;
    mockAuditLog = null;
  });

  describe('1. Direct Employee Creation by Business Owner', () => {
    it('should directly create an active employee with hashed password and role assignment in a transaction', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: mockRoleId,
        name: 'Counter Cashier',
        code: 'CASHIER',
        organizationId: mockOrgId,
      });
      mockPrismaService.outlet.findFirst.mockResolvedValue({
        id: mockOutletId,
        name: 'Tenkasi Branch',
        code: 'TENKASI',
        organizationId: mockOrgId,
      });

      mockPrismaService.user.create.mockImplementation(async (args) => {
        mockCreatedUser = { id: 'user-anand-1', ...args.data };
        return mockCreatedUser;
      });

      mockPrismaService.organizationMembership.create.mockImplementation(async (args) => {
        mockMembership = { id: 'org-mem-1', ...args.data };
        return mockMembership;
      });

      mockPrismaService.outletMembership.create.mockImplementation(async (args) => {
        mockOutletMembership = { id: 'outlet-mem-1', ...args.data };
        return mockOutletMembership;
      });

      mockPrismaService.membershipRole.create.mockResolvedValue({ id: 'mem-role-1' });

      mockPrismaService.auditLog.create.mockImplementation(async (args) => {
        mockAuditLog = args.data;
        return { id: 'audit-1' };
      });

      const res = await iamService.inviteUser(
        mockOrgId,
        {
          firstName: 'Anand',
          lastName: 'Kumar',
          email: 'Anand@NovaMart.com',
          phone: '+91 98765 43210',
          roleId: mockRoleId,
          outletId: mockOutletId,
          password: 'Password@123',
          confirmPassword: 'Password@123',
        },
        mockOwnerId,
      );

      // Verify User Created Correctly
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(mockCreatedUser.email).toBe('anand@novamart.com');
      expect(mockCreatedUser.isActive).toBe(true);
      expect(mockCreatedUser.passwordHash).toBeDefined();
      expect(mockCreatedUser.passwordHash).not.toBe('Password@123');
      const isPasswordValid = await bcrypt.compare('Password@123', mockCreatedUser.passwordHash);
      expect(isPasswordValid).toBe(true);

      // Verify Membership & Outlet
      expect(mockMembership.status).toBe('ACTIVE');
      expect(mockMembership.organizationId).toBe(mockOrgId);
      expect(mockOutletMembership.outletId).toBe(mockOutletId);

      // Verify Audit Log
      expect(mockAuditLog.action).toBe('EMPLOYEE_CREATED');
      expect(mockAuditLog.userId).toBe(mockOwnerId);

      // Verify Response Sanitization
      expect(res.id).toBe('user-anand-1');
      expect(res.status).toBe('ACTIVE');
      expect((res as any).password).toBeUndefined();
      expect((res as any).passwordHash).toBeUndefined();
    });

    it('should reject employee creation if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        email: 'anand@novamart.com',
      });

      await expect(
        iamService.inviteUser(mockOrgId, {
          firstName: 'Anand',
          lastName: 'Kumar',
          email: 'anand@novamart.com',
          roleId: mockRoleId,
          password: 'Password@123',
          confirmPassword: 'Password@123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject employee creation if password is less than 8 characters', async () => {
      await expect(
        iamService.inviteUser(mockOrgId, {
          firstName: 'Anand',
          lastName: 'Kumar',
          email: 'anand@novamart.com',
          roleId: mockRoleId,
          password: '123',
          confirmPassword: '123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject employee creation if passwords do not match', async () => {
      await expect(
        iamService.inviteUser(mockOrgId, {
          firstName: 'Anand',
          lastName: 'Kumar',
          email: 'anand@novamart.com',
          roleId: mockRoleId,
          password: 'Password@123',
          confirmPassword: 'DifferentPassword@123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject assignment of unauthorized outlet from another tenant', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: mockRoleId,
        name: 'Counter Cashier',
        code: 'CASHIER',
        organizationId: mockOrgId,
      });
      // Outlet belongs to foreign org
      mockPrismaService.outlet.findFirst.mockResolvedValue(null);

      await expect(
        iamService.inviteUser(mockOrgId, {
          firstName: 'Anand',
          lastName: 'Kumar',
          email: 'anand@novamart.com',
          roleId: mockRoleId,
          outletId: 'foreign-outlet-id',
          password: 'Password@123',
          confirmPassword: 'Password@123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject assignment of platform SUPER_ADMIN role to employee', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'super-admin-role',
        name: 'Super Admin',
        code: 'SUPER_ADMIN',
      });

      await expect(
        iamService.inviteUser(mockOrgId, {
          firstName: 'Anand',
          lastName: 'Kumar',
          email: 'anand@novamart.com',
          roleId: 'super-admin-role',
          password: 'Password@123',
          confirmPassword: 'Password@123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Direct Employee Login & Scoped Access', () => {
    it('should authenticate newly created employee with their password and return scoped session', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-anand-1',
        email: 'anand@novamart.com',
        passwordHash,
        firstName: 'Anand',
        lastName: 'Kumar',
        isSuperAdmin: false,
        isActive: true,
      });

      mockPrismaService.organizationMembership.findMany.mockResolvedValue([
        {
          id: 'org-mem-1',
          status: 'ACTIVE',
          organization: {
            id: mockOrgId,
            name: 'Nova Supermarket',
            slug: 'nova-supermarket',
            businessType: 'RETAIL',
            outlets: [{ id: mockOutletId, name: 'Tenkasi Branch', code: 'TENKASI' }],
          },
          membershipRoles: [{ role: { code: 'CASHIER', name: 'Counter Cashier' } }],
          outletMemberships: [{ outlet: { id: mockOutletId, name: 'Tenkasi Branch', code: 'TENKASI' } }],
        },
      ]);

      mockPrismaService.userSession.create.mockResolvedValue({ id: 'session-1' });

      const loginRes = await authService.login({
        email: 'Anand@NovaMart.com',
        password: 'Password@123',
      });

      expect(loginRes.user.id).toBe('user-anand-1');
      expect(loginRes.user.email).toBe('anand@novamart.com');
      expect(loginRes.organizations.length).toBe(1);
      expect(loginRes.organizations[0].roleCode).toBe('CASHIER');
      expect(loginRes.organizations[0].outlets[0].outletId).toBe(mockOutletId);
      expect(loginRes.tokens).toBeDefined();
    });

    it('should deny login if password is incorrect', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-anand-1',
        email: 'anand@novamart.com',
        passwordHash,
        isActive: true,
      });

      await expect(
        authService.login({
          email: 'anand@novamart.com',
          password: 'WrongPassword@999',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should deny login if employee account is suspended', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-anand-1',
        email: 'anand@novamart.com',
        passwordHash: 'hash',
        isActive: false,
      });

      await expect(
        authService.login({
          email: 'anand@novamart.com',
          password: 'Password@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/database/prisma.service';
import * as bcrypt from 'bcryptjs';

describe('Google Authentication & Session Service', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userSession: {
        create: jest.fn().mockResolvedValue({ id: 'sess-1' }),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organizationMembership: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
      verify: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string, def?: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'mock-google-client-id.apps.googleusercontent.com';
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        return def;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);

    // Mock OAuth2Client verifyIdToken
    (authService as any).googleClient = {
      verifyIdToken: jest.fn().mockImplementation(async ({ idToken }) => {
        if (idToken === 'valid-google-id-token') {
          return {
            getPayload: () => ({
              sub: 'google-sub-12345',
              email: 'priya@novamart.com',
              email_verified: true,
              given_name: 'Priya',
              family_name: 'Sharma',
              picture: 'https://lh3.googleusercontent.com/a/mock-pic',
            }),
          };
        }
        if (idToken === 'new-user-token') {
          return {
            getPayload: () => ({
              sub: 'google-sub-99999',
              email: 'newuser@example.com',
              email_verified: true,
              given_name: 'New',
              family_name: 'User',
              picture: null,
            }),
          };
        }
        if (idToken === 'unverified-email-token') {
          return {
            getPayload: () => ({
              sub: 'google-sub-00000',
              email: 'unverified@example.com',
              email_verified: false,
            }),
          };
        }
        throw new Error('Invalid token');
      }),
    };
  });

  describe('googleLogin', () => {
    it('1. Should authenticate returning Google user with existing googleSub', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'priya@novamart.com',
        firstName: 'Priya',
        lastName: 'Sharma',
        googleSub: 'google-sub-12345',
        authProvider: 'GOOGLE',
        isActive: true,
        isSuperAdmin: false,
        avatarUrl: 'https://lh3.googleusercontent.com/a/mock-pic',
      });

      mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([
        {
          organization: { id: 'org-1', name: 'Nova Supermarket', slug: 'nova-supermarket', businessType: 'SUPERMARKET', outlets: [] },
          membershipRoles: [{ role: { code: 'OWNER', name: 'Owner' } }],
          outletMemberships: [],
        },
      ]);

      const res = await authService.googleLogin({ idToken: 'valid-google-id-token' });

      expect(res.user.email).toBe('priya@novamart.com');
      expect(res.tokens?.accessToken).toBe('mock.jwt.token');
      expect(res.organizations.length).toBe(1);
      expect(res.organizations[0].roleCode).toBe('OWNER');
    });

    it('2. Should reject suspended/inactive Google user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-suspended',
        email: 'priya@novamart.com',
        googleSub: 'google-sub-12345',
        isActive: false,
      });

      await expect(
        authService.googleLogin({ idToken: 'valid-google-id-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('3. Should provision new provisional user and redirect to onboarding', async () => {
      // Not found by googleSub
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Not found by email
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'user-new',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        googleSub: 'google-sub-99999',
        authProvider: 'GOOGLE',
        isActive: true,
        isSuperAdmin: false,
        avatarUrl: null,
      });

      mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([]);

      const res = await authService.googleLogin({ idToken: 'new-user-token' });

      expect(res.isNewUser).toBe(true);
      expect(res.user.email).toBe('newuser@example.com');
      expect(res.organizations).toEqual([]);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newuser@example.com',
            authProvider: 'GOOGLE',
            passwordHash: null,
          }),
        }),
      );
    });

    it('4. Should request password confirmation if email matches existing email/password account', async () => {
      // Not found by googleSub
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Found by email without googleSub
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-existing',
        email: 'priya@novamart.com',
        firstName: 'Priya',
        lastName: 'Sharma',
        googleSub: null,
        passwordHash: '$2a$10$hashedPassword123',
        isActive: true,
        isSuperAdmin: false,
      });

      const res = await authService.googleLogin({ idToken: 'valid-google-id-token' });

      expect(res.requiresPasswordLink).toBe(true);
      expect(res.googleEmail).toBe('priya@novamart.com');
      expect(res.tokens).toBeUndefined();
    });

    it('5. Should securely link Google account when valid password confirmation is provided', async () => {
      const hashed = await bcrypt.hash('CorrectPassword123', 10);

      // Not found by googleSub
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Found by email
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-existing',
        email: 'priya@novamart.com',
        firstName: 'Priya',
        lastName: 'Sharma',
        googleSub: null,
        passwordHash: hashed,
        isActive: true,
        isSuperAdmin: false,
      });

      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'user-existing',
        email: 'priya@novamart.com',
        firstName: 'Priya',
        lastName: 'Sharma',
        googleSub: 'google-sub-12345',
        authProvider: 'LOCAL_AND_GOOGLE',
        isActive: true,
        isSuperAdmin: false,
      });

      mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([]);

      const res = await authService.googleLogin({
        idToken: 'valid-google-id-token',
        linkPassword: 'CorrectPassword123',
      });

      expect(res.tokens?.accessToken).toBe('mock.jwt.token');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-existing' },
          data: expect.objectContaining({
            googleSub: 'google-sub-12345',
            authProvider: 'LOCAL_AND_GOOGLE',
          }),
        }),
      );
    });

    it('6. Should reject account link with incorrect password', async () => {
      const hashed = await bcrypt.hash('RealPassword123', 10);

      // Not found by googleSub
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Found by email
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-existing',
        email: 'priya@novamart.com',
        passwordHash: hashed,
        isActive: true,
      });

      await expect(
        authService.googleLogin({
          idToken: 'valid-google-id-token',
          linkPassword: 'WrongPassword999',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('7. Should reject Google login if Google email is not verified', async () => {
      await expect(
        authService.googleLogin({ idToken: 'unverified-email-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login (Normal Email/Password)', () => {
    it('8. Should reject normal password login if user only has Google Sign-In and no password', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'google-only-user',
        email: 'googleuser@example.com',
        passwordHash: null,
        isActive: true,
      });

      await expect(
        authService.login({ email: 'googleuser@example.com', password: 'AnyPassword' }),
      ).rejects.toThrow(/Google Sign-In/);
    });
  });
});

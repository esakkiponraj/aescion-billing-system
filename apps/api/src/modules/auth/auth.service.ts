import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import {
  AuthSessionResponse,
  AuthenticatedUser,
  BusinessType,
  UserOrganizationSummary,
} from '@aescion/types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client();
  }

  async register(dto: RegisterDto): Promise<AuthSessionResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        isSuperAdmin: false,
        isActive: true,
        authProvider: 'LOCAL',
      },
    });

    return this.generateAuthResponse(user);
  }

  async login(
    dto: LoginDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been suspended. Contact your business administrator.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account was created with Google Sign-In. Please click "Continue with Google" to sign in.',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.generateAuthResponse(user, meta);
  }

  async googleLogin(
    dto: GoogleLoginDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthSessionResponse> {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: googleClientId ? [googleClientId] : undefined,
      });
    } catch (err: any) {
      this.logger.warn(`Google token verification failed: ${err?.message}`);
      throw new UnauthorizedException('Invalid or expired Google authentication token.');
    }

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('Unable to extract Google user credentials.');
    }

    const googleSub = payload.sub;
    const email = payload.email?.toLowerCase().trim();
    const emailVerified = payload.email_verified;
    const firstName = payload.given_name || payload.name?.split(' ')[0] || 'User';
    const lastName = payload.family_name || (payload.name?.split(' ').length ? payload.name.split(' ').slice(1).join(' ') : '') || '';
    const avatarUrl = payload.picture || null;

    if (!googleSub || !email) {
      throw new UnauthorizedException('Google identity missing required identifiers.');
    }

    if (emailVerified === false) {
      throw new UnauthorizedException(
        'Your Google email address is not verified. Please verify your Google account before signing in.',
      );
    }

    // 1. Check if user already exists by googleSub
    const existingByGoogleSub = await this.prisma.user.findUnique({
      where: { googleSub },
    });

    if (existingByGoogleSub) {
      if (!existingByGoogleSub.isActive) {
        throw new UnauthorizedException(
          'Your account has been suspended. Contact your business administrator.',
        );
      }

      // Update avatar if newly available
      if (avatarUrl && !existingByGoogleSub.avatarUrl) {
        await this.prisma.user.update({
          where: { id: existingByGoogleSub.id },
          data: { avatarUrl },
        });
        existingByGoogleSub.avatarUrl = avatarUrl;
      }

      return this.generateAuthResponse(existingByGoogleSub, meta);
    }

    // 2. Check if user exists with matching email but googleSub is not linked yet
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        throw new UnauthorizedException(
          'Your account has been suspended. Contact your business administrator.',
        );
      }

      // If user provided their existing password for account linking
      if (dto.linkPassword) {
        if (!existingByEmail.passwordHash) {
          throw new UnauthorizedException('Existing account has no password set.');
        }

        const isMatch = await bcrypt.compare(dto.linkPassword, existingByEmail.passwordHash);
        if (!isMatch) {
          throw new UnauthorizedException(
            'Invalid password for account linking. Please enter your existing AESCION password.',
          );
        }

        // Link Google account to existing user
        const updatedUser = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleSub,
            googleLinkedAt: new Date(),
            authProvider: 'LOCAL_AND_GOOGLE',
            avatarUrl: existingByEmail.avatarUrl || avatarUrl,
            isEmailVerified: true,
          },
        });

        return this.generateAuthResponse(updatedUser, meta);
      }

      // Password not provided yet -> Prompt user to confirm password to link account
      return {
        user: {
          id: existingByEmail.id,
          email: existingByEmail.email,
          firstName: existingByEmail.firstName,
          lastName: existingByEmail.lastName,
          phone: existingByEmail.phone,
          avatarUrl: existingByEmail.avatarUrl,
          isSuperAdmin: existingByEmail.isSuperAdmin,
          isActive: existingByEmail.isActive,
        },
        organizations: [],
        requiresPasswordLink: true,
        googleEmail: email,
        message:
          'An account with this email address already exists. Please confirm your password to link your Google account.',
      };
    }

    // 3. Brand new Google user: Provision minimal profile and redirect to Onboarding
    const newUser = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        avatarUrl,
        googleSub,
        authProvider: 'GOOGLE',
        isEmailVerified: true,
        isSuperAdmin: false,
        isActive: true,
        passwordHash: null,
      },
    });

    const authRes = await this.generateAuthResponse(newUser, meta);
    return {
      ...authRes,
      isNewUser: true,
    };
  }

  async refreshToken(
    refreshToken: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthSessionResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'aescion_refresh_jwt_token_secret_dev_key_2026',
        ),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh session.');
      }

      // Check session validity in database
      const session = await this.prisma.userSession.findFirst({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!session) {
        throw new UnauthorizedException('Session has been revoked or expired.');
      }

      // Rotate session: revoke old session, create new
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      return this.generateAuthResponse(user, meta);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getSession(userId: string): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('User profile not found.');
    }

    return this.buildSessionData(user);
  }

  async generateAuthResponse(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      avatarUrl?: string | null;
      isSuperAdmin: boolean;
      isActive: boolean;
    },
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthSessionResponse> {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>(
        'JWT_SECRET',
        'aescion_ultra_secure_jwt_secret_dev_key_2026',
      ),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>(
        'JWT_REFRESH_SECRET',
        'aescion_refresh_jwt_token_secret_dev_key_2026',
      ),
      expiresIn: '7d',
    });

    // Save session in DB
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        expiresAt,
      },
    });

    const sessionData = await this.buildSessionData(user);

    return {
      ...sessionData,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 mins in seconds
      },
    };
  }

  private async buildSessionData(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    avatarUrl?: string | null;
    isSuperAdmin: boolean;
    isActive: boolean;
  }): Promise<Omit<AuthSessionResponse, 'tokens'>> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      include: {
        organization: {
          include: {
            outlets: {
              where: { isActive: true },
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
          },
        },
      },
    });

    const organizations: UserOrganizationSummary[] = memberships.map((m) => {
      const primaryRole = m.membershipRoles[0]?.role;
      const authorizedOutlets =
        m.outletMemberships.length > 0
          ? m.outletMemberships.map((om) => ({
              outletId: om.outlet.id,
              outletName: om.outlet.name,
              outletCode: om.outlet.code,
            }))
          : m.organization.outlets.map((o) => ({
              outletId: o.id,
              outletName: o.name,
              outletCode: o.code,
            }));

      return {
        organizationId: m.organization.id,
        organizationName: m.organization.name,
        organizationSlug: m.organization.slug,
        businessType: m.organization.businessType as BusinessType,
        roleCode: primaryRole?.code || 'MEMBER',
        roleName: primaryRole?.name || 'Member',
        outlets: authorizedOutlets,
      };
    });

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isSuperAdmin: user.isSuperAdmin,
      isActive: user.isActive,
    };

    return {
      user: authUser,
      organizations,
    };
  }
}

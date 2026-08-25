import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { IamModule } from './modules/iam/iam.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AuditModule } from './modules/audit/audit.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ProductsModule } from './modules/products/products.module';
import { PresenceModule } from './modules/presence/presence.module';
import { PaymentsModule } from './modules/payments/payments.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    AuthModule,
    TenancyModule,
    IamModule,
    OnboardingModule,
    ApprovalsModule,
    AuditModule,
    SuperAdminModule,
    FinanceModule,
    ProductsModule,
    PresenceModule,
    PaymentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '@aescion/types';

export const CurrentTenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenantContext as TenantContext;
    return data ? tenant?.[data] : tenant;
  },
);

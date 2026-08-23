import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PermissionCode, TenantContext } from '@aescion/types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<PermissionCode[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantContext = request.tenantContext as TenantContext;

    if (user?.isSuperAdmin) {
      return true;
    }

    if (!tenantContext) {
      throw new ForbiddenException(
        'Tenant context is missing. Provide X-Organization-Id header.',
      );
    }

    const userPermCodes = new Set([
      ...tenantContext.permissions.map((p) => p.code),
      ...tenantContext.permissions.map((p) => p.code.replace('.', ':')),
      ...tenantContext.permissions.map((p) => p.code.replace(':', '.')),
    ]);

    // Check if user has ALL required permissions (or Owner role bypass)
    if (tenantContext.roles.includes('OWNER')) {
      return true;
    }

    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermCodes.has(perm) ||
      userPermCodes.has(perm.replace('.', ':')) ||
      userPermCodes.has(perm.replace(':', '.'))
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Access Denied: Missing required permission(s): ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}

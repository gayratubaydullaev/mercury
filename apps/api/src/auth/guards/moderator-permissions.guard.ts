import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { MODERATOR_PERMISSION_KEY, ModeratorPermissionKey } from '../decorators/require-moderator-permission.decorator';

@Injectable()
export class ModeratorPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<ModeratorPermissionKey | undefined>(
      MODERATOR_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string; moderatorPermissions?: Record<string, boolean> } | undefined;
    if (!user) return false;

    if (user.role === UserRole.ADMIN) return true;
    if (user.role !== UserRole.ADMIN_MODERATOR) return false;

    const perms = user.moderatorPermissions;
    if (perms == null) return true;
    if (perms[permission] === false) return false;
    return true;
  }
}

import {
  ForbiddenException,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { Role } from '@qlhs/contracts'

export const ROLES_KEY = 'qlhs:roles'

/** Restrict a route to the given roles, checked against the user's activeRole (H3). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!required || required.length === 0) return true

    const active = ctx.switchToHttp().getRequest<Request>().currentUser?.activeRole
    if (!active || !required.includes(active)) {
      throw new ForbiddenException({ code: 'ForbiddenRole', message: 'Vai hiện tại không có quyền' })
    }
    return true
  }
}

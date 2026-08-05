import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import type { Request } from 'express'
import { SessionAuthService } from '../../infra/session/session-auth.service'
import { UserRoleRepo } from '../../infra/prisma/users/user-role.repo'
import { effectiveRoles, resolveActiveRole } from '../../domain/auth/roles'
import { loadAuthConfig } from '../../config/auth.config'

/**
 * Verifies the session cookie and attaches `currentUser` (sub + roles +
 * activeRole) to the request. Roles are re-read from the DB on every request —
 * never trusted from the login-time session snapshot — so an Admin's grant or
 * revocation takes effect on the user's next request, not only after re-login.
 * Role×state guards downstream read `activeRole` (H3), never the union of roles.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly cookieName = loadAuthConfig(process.env).cookieName

  constructor(
    private readonly sessionAuth: SessionAuthService,
    private readonly userRoles: UserRoleRepo,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>()
    const sid = req.cookies?.[this.cookieName] as string | undefined
    // Enforces access-token expiry + silent refresh, not just the 12h cap: a
    // revoked SSO grant ends the session here without needing back-channel logout.
    const session = await this.sessionAuth.resolve(sid)
    if (!session) {
      throw new UnauthorizedException({ code: 'Unauthenticated', message: 'Chưa đăng nhập' })
    }
    const roles = effectiveRoles(await this.userRoles.rolesForSub(session.sub))
    const activeRole = resolveActiveRole(roles, session.activeRole)
    req.currentUser = {
      sub: session.sub,
      roles,
      activeRole,
      displayName: session.displayName,
    }
    req.sessionId = sid
    return true
  }
}

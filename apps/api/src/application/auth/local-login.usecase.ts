import { Injectable } from '@nestjs/common'
import type { Role } from '@qlhs/contracts'
import { LocalCredentialRepo } from '../../infra/prisma/users/local-credential.repo'
import { UserRoleRepo } from '../../infra/prisma/users/user-role.repo'
import { verifyPassword } from '../../infra/auth/password'

export interface LocalIdentity {
  sub: string
  username: string
  roles: Role[]
}

/** Authenticate a local (non-SSO) SA by username + password (break-glass).
 *  Returns null on any failure — the controller maps that to a single opaque
 *  401 (no user oracle). Emails never reach here (they route to SSO), so the
 *  identifier is a plain username like "admin.ssa". */
@Injectable()
export class LocalLoginUseCase {
  constructor(
    private readonly creds: LocalCredentialRepo,
    private readonly userRoles: UserRoleRepo,
  ) {}

  async execute(username: string, password: string): Promise<LocalIdentity | null> {
    const cred = await this.creds.findByUsername(username.trim())
    if (!cred) return null
    if (!(await verifyPassword(password, cred.passwordHash))) return null
    const roles = await this.userRoles.rolesForSub(cred.sub)
    return { sub: cred.sub, username: cred.username, roles }
  }
}

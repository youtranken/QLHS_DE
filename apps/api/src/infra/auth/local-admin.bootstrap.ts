import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { PrismaService } from '../prisma/prisma.service'
import { UserRoleRepo } from '../prisma/users/user-role.repo'
import { LocalCredentialRepo } from '../prisma/users/local-credential.repo'
import { loadAuthConfig } from '../../config/auth.config'
import { hashPassword } from './password'

/** Stable identity for the single break-glass local SA. */
export const LOCAL_ADMIN_SUB = 'local:admin-ssa'

/** Display email for the local SA identity (UI/audit only — not a real mailbox,
 *  and never a login route). Matches QLTS's LOCAL_SA_EMAIL. */
export const LOCAL_ADMIN_EMAIL = 'ssa@local.com'

/**
 * Seeds the local (non-SSO) SA from QLHS_LOCAL_ADMIN_EMAIL/PASSWORD on boot:
 * a User row, the Admin role, and scrypt-hashed credentials. Idempotent — the
 * env is the source of truth, so the password is re-applied every start. This is
 * also the recovery path after e2e specs wipe user/user_role on the shared dev DB.
 */
@Injectable()
export class LocalAdminBootstrap implements OnModuleInit {
  private readonly log = new Logger(LocalAdminBootstrap.name)
  private readonly cfg = loadAuthConfig(process.env)

  constructor(
    private readonly prisma: PrismaService,
    private readonly userRoles: UserRoleRepo,
    private readonly creds: LocalCredentialRepo,
  ) {}

  async onModuleInit(): Promise<void> {
    const la = this.cfg.localAdmin
    if (!la) return
    await this.prisma.user.upsert({
      where: { sub: LOCAL_ADMIN_SUB },
      create: { sub: LOCAL_ADMIN_SUB, email: LOCAL_ADMIN_EMAIL, fullName: 'System Admin (local SA)' },
      update: { email: LOCAL_ADMIN_EMAIL },
    })
    await this.userRoles.ensureRole(LOCAL_ADMIN_SUB, ROLE.Admin)
    await this.creds.upsert(LOCAL_ADMIN_SUB, la.username, await hashPassword(la.password))
    this.log.log(`Local SA ready: ${la.username}`)
  }
}

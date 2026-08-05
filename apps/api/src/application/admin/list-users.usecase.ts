import { Injectable, Logger } from '@nestjs/common'
import { DirectoryClient } from '../../infra/pmh-id/directory.client'
import { UserRoleRepo, type UserWithRoles } from '../../infra/prisma/users/user-role.repo'

export interface AdminUserRow extends UserWithRoles {
  /** True once the person has a local QLHS record — i.e. has logged in at least
   *  once (the `user` table is written on login). Lets Admin TRACK who from the
   *  PMH ID directory is actually onboarded, not just who holds a role. */
  hasAccount: boolean
}

/**
 * The Admin user list: everyone the client can see in the SSO Directory (so
 * roles can be assigned before first login), each with their local roles and
 * whether they have logged into QLHS yet. Falls back to locally-known users if
 * the Directory API is unreachable.
 */
@Injectable()
export class ListUsersUseCase {
  private readonly logger = new Logger(ListUsersUseCase.name)

  constructor(
    private readonly directory: DirectoryClient,
    private readonly userRoles: UserRoleRepo,
  ) {}

  async execute(): Promise<AdminUserRow[]> {
    const roleMap = await this.userRoles.rolesBySubMap()
    const local = await this.userRoles.listUsersWithRoles()
    const onboarded = new Set(local.map((u) => u.sub))
    try {
      const dir = await this.directory.listUsers()
      return dir.map((u) => ({
        sub: u.sub,
        email: u.email,
        fullName: u.fullName,
        roles: roleMap.get(u.sub) ?? [],
        hasAccount: onboarded.has(u.sub),
      }))
    } catch (err) {
      this.logger.warn(`Directory API unavailable, falling back to local users: ${String(err)}`)
      return local.map((u) => ({ ...u, hasAccount: true }))
    }
  }
}

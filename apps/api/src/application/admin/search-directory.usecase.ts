import { Injectable } from '@nestjs/common'
import type { Role } from '@qlhs/contracts'
import { ListUsersUseCase } from './list-users.usecase'
import { UserRoleRepo, type UserWithRoles } from '../../infra/prisma/users/user-role.repo'
import { UserDirectoryRepo } from '../../infra/prisma/users/user-directory.repo'
import { LocalCredentialRepo } from '../../infra/prisma/users/local-credential.repo'

export interface DirectoryMatch {
  sub: string
  email: string | null
  fullName: string | null
  roles: Role[]
  /** True once the person has a local record (logged into QLHS at least once). */
  hasAccount: boolean
}

const LIMIT = 20

/**
 * N4 appoint search: find people on PMH ID by email / name / sub to grant a QLHS
 * role before or after their first login (AD-7 — identity is the `sub`). Reuses
 * the Directory listing (local fallback) + flags who already has a QLHS account.
 */
@Injectable()
export class SearchDirectoryUseCase {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly userRoles: UserRoleRepo,
    private readonly directory: UserDirectoryRepo,
    private readonly localCreds: LocalCredentialRepo,
  ) {}

  async execute(q: string): Promise<DirectoryMatch[]> {
    // Union the Directory (or its local fallback) with locally-known users, so a
    // person appointed/seen locally but absent from the Directory feed stays
    // searchable — but drop break-glass/local-credential accounts: they are not
    // PMH people and must never surface in the SSO appoint search.
    const [dir, local, localOnly] = await Promise.all([
      this.listUsers.execute(),
      this.userRoles.listUsersWithRoles(),
      this.localCreds.listSubs(),
    ])
    const bySub = new Map<string, UserWithRoles>()
    for (const u of dir) bySub.set(u.sub, u)
    for (const u of local) if (!bySub.has(u.sub)) bySub.set(u.sub, u)
    for (const sub of localOnly) bySub.delete(sub)
    const all = [...bySub.values()]
    const needle = q.trim().toLowerCase()
    const matched = (
      needle
        ? all.filter(
            (u) =>
              (u.email ?? '').toLowerCase().includes(needle) ||
              (u.fullName ?? '').toLowerCase().includes(needle) ||
              u.sub.toLowerCase().includes(needle),
          )
        : all
    ).slice(0, LIMIT)

    const known = await this.directory.namesForSubs(matched.map((u) => u.sub))
    return matched.map((u) => ({
      sub: u.sub,
      email: u.email,
      fullName: u.fullName,
      roles: u.roles,
      hasAccount: u.sub in known,
    }))
  }
}

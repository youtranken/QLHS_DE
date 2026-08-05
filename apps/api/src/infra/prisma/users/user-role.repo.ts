import { Injectable } from '@nestjs/common'
import { ALL_ROLES, type Role } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'

/** F11 digest recipient — resolved name + email so the mailer needs no re-lookup. */
export interface DigestRecipient {
  sub: string
  email: string
  name: string
  roles: Role[]
}

export interface UserWithRoles {
  sub: string
  email: string | null
  fullName: string | null
  roles: Role[]
}

/**
 * Local role assignments (SA-managed authorization). The QLHS role of a user is
 * whatever an Admin has stored here — never derived from PMH groups.
 */
@Injectable()
export class UserRoleRepo {
  constructor(private readonly prisma: PrismaService) {}

  async rolesForSub(sub: string): Promise<Role[]> {
    const rows = await this.prisma.userRole.findMany({ where: { sub } })
    const held = new Set(rows.map((r) => r.role))
    return ALL_ROLES.filter((r) => held.has(r))
  }

  async ensureRole(sub: string, role: Role): Promise<void> {
    await this.prisma.userRole.upsert({
      where: { sub_role: { sub, role } },
      create: { sub, role },
      update: {},
    })
  }

  async setRoles(sub: string, roles: readonly Role[]): Promise<void> {
    const unique = ALL_ROLES.filter((r) => roles.includes(r))
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { sub } }),
      ...unique.map((role) => this.prisma.userRole.create({ data: { sub, role } })),
    ])
  }

  async rolesBySubMap(): Promise<Map<string, Role[]>> {
    const rows = await this.prisma.userRole.findMany()
    const held = new Map<string, Set<string>>()
    for (const r of rows) {
      const set = held.get(r.sub) ?? new Set<string>()
      set.add(r.role)
      held.set(r.sub, set)
    }
    const out = new Map<string, Role[]>()
    for (const [sub, set] of held) {
      out.set(
        sub,
        ALL_ROLES.filter((r) => set.has(r)),
      )
    }
    return out
  }

  /**
   * F11 — people eligible for the morning digest: locally-known users holding one
   * of `roles`, who have an email and have not opted out. Deliberately separate
   * from `listUsersWithRoles` (the Admin list): that one is Directory-first and
   * knows nothing about a local mail preference.
   */
  async listDigestRecipients(roles: readonly Role[]): Promise<DigestRecipient[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        digestOptOut: false,
        email: { not: null },
        status: 'active',
      },
      select: { sub: true, email: true, fullName: true },
    })
    const assigned = await this.prisma.userRole.findMany({
      where: { role: { in: [...roles] }, sub: { in: rows.map((r) => r.sub) } },
    })
    const bySub = new Map<string, Role[]>()
    for (const a of assigned) {
      bySub.set(a.sub, [...(bySub.get(a.sub) ?? []), a.role as Role])
    }
    return rows
      .filter((r) => bySub.has(r.sub))
      .map((r) => ({
        sub: r.sub,
        email: r.email as string,
        name: r.fullName ?? (r.email as string),
        roles: bySub.get(r.sub) as Role[],
      }))
  }

  async listUsersWithRoles(): Promise<UserWithRoles[]> {
    const [users, roles] = await Promise.all([
      this.prisma.user.findMany({ orderBy: { syncedAt: 'desc' } }),
      this.prisma.userRole.findMany(),
    ])
    const bySub = new Map<string, Set<string>>()
    for (const r of roles) {
      const set = bySub.get(r.sub) ?? new Set<string>()
      set.add(r.role)
      bySub.set(r.sub, set)
    }
    return users.map((u) => {
      const held = bySub.get(u.sub) ?? new Set<string>()
      return {
        sub: u.sub,
        email: u.email,
        fullName: u.fullName,
        roles: ALL_ROLES.filter((r) => held.has(r)),
      }
    })
  }
}

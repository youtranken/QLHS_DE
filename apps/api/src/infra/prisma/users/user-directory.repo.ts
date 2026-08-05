import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

/**
 * AD-12 directory cache: resolves a PMH `sub` to a human display name so the UI
 * never surfaces the raw sub. Identity stays the sub (AD-7); this is display only.
 */
@Injectable()
export class UserDirectoryRepo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records the user on login so an Admin can assign roles before the user
   * holds any. Keyed by sub (AD-7); name/email are display fields only.
   */
  async upsertUser(input: { sub: string; fullName?: string; email?: string }): Promise<void> {
    const fullName = input.fullName ?? null
    const email = input.email ?? null
    await this.prisma.user.upsert({
      where: { sub: input.sub },
      create: { sub: input.sub, fullName, email },
      update: { fullName, email },
    })
  }

  /** Offboarding (PMH ID webhook): flip the local directory status so admin
   *  screens reflect it. No-op if the sub was never seen locally. */
  async setStatus(sub: string, status: 'locked' | 'deleted'): Promise<void> {
    await this.prisma.user.updateMany({ where: { sub }, data: { status } })
  }

  /** F11 — read/write the morning-digest preference for one person. */
  async digestOptOut(sub: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({ where: { sub }, select: { digestOptOut: true } })
    return row?.digestOptOut ?? false
  }

  async setDigestOptOut(sub: string, optOut: boolean): Promise<void> {
    await this.prisma.user.update({ where: { sub }, data: { digestOptOut: optOut } })
  }

  /** sub → (fullName ?? email). Subs with neither are omitted (caller falls back). */
  async namesForSubs(subs: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(subs.filter(Boolean))]
    if (unique.length === 0) return {}
    const rows = await this.prisma.user.findMany({
      where: { sub: { in: unique } },
      select: { sub: true, fullName: true, email: true },
    })
    const out: Record<string, string> = {}
    for (const r of rows) {
      const name = r.fullName ?? r.email
      if (name) out[r.sub] = name
    }
    return out
  }
}

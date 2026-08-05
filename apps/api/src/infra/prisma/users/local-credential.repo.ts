import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface LocalCredential {
  sub: string
  username: string
  passwordHash: string
}

/** Storage for local (non-SSO) SA credentials. Keyed by a username identifier
 *  (e.g. "admin.ssa") — never an email; emails always go through SSO. */
@Injectable()
export class LocalCredentialRepo {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string): Promise<LocalCredential | null> {
    return this.prisma.localCredential.findUnique({ where: { username } })
  }

  /** Subs of every local (non-SSO) account — used to keep break-glass identities
   *  out of the PMH ID appoint search. */
  async listSubs(): Promise<string[]> {
    const rows = await this.prisma.localCredential.findMany({ select: { sub: true } })
    return rows.map((r) => r.sub)
  }

  async upsert(sub: string, username: string, passwordHash: string): Promise<void> {
    await this.prisma.localCredential.upsert({
      where: { sub },
      create: { sub, username, passwordHash },
      update: { username, passwordHash },
    })
  }
}

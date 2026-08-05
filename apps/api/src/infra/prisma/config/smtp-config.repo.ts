import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface SmtpConfigWrite {
  host: string | null
  port: number | null
  secure: boolean
  username: string | null
  /** Already-encrypted blob, or null to leave unchanged is handled by the caller. */
  passwordEnc: string | null
  fromAddr: string | null
  updatedBy: string | null
}

/** The singleton (id=1) SMTP config row. Reads/writes only — no delete. */
@Injectable()
export class SmtpConfigRepo {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.smtpConfig.findUnique({ where: { id: 1 } })
  }

  upsert(data: SmtpConfigWrite) {
    const { updatedBy, ...rest } = data
    return this.prisma.smtpConfig.upsert({
      where: { id: 1 },
      create: { id: 1, ...rest, updatedBy },
      update: { ...rest, updatedBy },
    })
  }
}

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

/**
 * SLA thresholds keyed by (status, flow) (B4). Flow-specific row wins; else the
 * `'*'` baseline; else null (closed status → no badge). Read at query time (AD-6).
 */
@Injectable()
export class SlaRepo {
  constructor(private readonly prisma: PrismaService) {}

  async threshold(status: string, flow: string): Promise<number | null> {
    const specific = await this.prisma.slaConfig.findUnique({
      where: { status_flow: { status, flow } },
    })
    if (specific) return specific.slaDays
    const baseline = await this.prisma.slaConfig.findUnique({
      where: { status_flow: { status, flow: '*' } },
    })
    return baseline?.slaDays ?? null
  }

  /** Every configured (status, flow) threshold — the admin-edit surface (5.1). */
  list(): Promise<SlaConfigRow[]> {
    return this.prisma.slaConfig.findMany({ orderBy: [{ flow: 'asc' }, { status: 'asc' }] })
  }

  /** Upsert one (status, flow) threshold, stamping who/when. No process-level cache,
   *  so `threshold()` picks up the new value on the very next read (AC1, AD-6). */
  async upsert(status: string, flow: string, slaDays: number, adminSub: string): Promise<void> {
    await this.prisma.slaConfig.upsert({
      where: { status_flow: { status, flow } },
      update: { slaDays, updatedBySub: adminSub },
      create: { status, flow, slaDays, updatedBySub: adminSub },
    })
  }
}

export interface SlaConfigRow {
  status: string
  flow: string
  slaDays: number
  updatedBySub: string | null
  updatedAt: Date
}

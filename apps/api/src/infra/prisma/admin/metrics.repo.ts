import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface TicketGauge {
  flow: string
  status: string
  count: number
}

export interface MetricsSnapshot {
  tickets: TicketGauge[]
  mailPending: number
  mailFailed: number
  digestPending: number
  digestFailed: number
}

/** Read model for `/metrics` + the backlog alert (3.2): a handful of cheap COUNTs,
 *  no SLA math (that stays derived on the analytics screens, AD-6). */
@Injectable()
export class MetricsRepo {
  constructor(private readonly prisma: PrismaService) {}

  async collect(): Promise<MetricsSnapshot> {
    const [tickets, mail, digest] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['flow', 'status'], _count: { _all: true } }),
      this.prisma.notificationOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.digestOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    const by = (rows: { status: string; _count: { _all: number } }[], s: string): number =>
      rows.find((r) => r.status === s)?._count._all ?? 0
    return {
      tickets: tickets.map((t) => ({ flow: t.flow, status: t.status, count: t._count._all })),
      mailPending: by(mail, 'pending'),
      mailFailed: by(mail, 'failed'),
      digestPending: by(digest, 'pending'),
      digestFailed: by(digest, 'failed'),
    }
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { TERMINAL_STATUSES, TICKET_STATUS } from '@qlhs/contracts'
import { PrismaService } from '../prisma/prisma.service'
import { SlaRepo } from '../prisma/sla/sla.repo'
import { SystemClock } from '../clock/system-clock'
import { SlaPauseRepo } from '../prisma/sla/sla-pause.repo'
import { businessDaysBetween } from '../../domain/sla/business-days'
import { overdueDays } from '../../domain/sla/overdue'
import { effectiveEnteredAt } from '../../domain/sla/pause'
import { makeThresholdOf } from '../../domain/admin/overview'
import {
  escalationIntent,
  stationRole,
  type EscalationConfig,
  type EscalationIntent,
} from '../../domain/notify/escalation'

// The Applicant's own courts are chased by the Return reminder, not this ladder.
const OFF_LADDER = [...TERMINAL_STATUSES, TICKET_STATUS.Returned, TICKET_STATUS.ReturnFixing]

interface Row {
  id: string
  code: string | null
  status: string
  flow: string
  currentHolderSub: string | null
  statusEnteredAt: Date
}

/**
 * 2.5 — walks every running DCC-owned ticket each hour and, using the SAME
 * pause-adjusted clock as every SLA badge (F8), posts at most one escalation per
 * tier per station into the 2.2 notification table. A partial unique index makes
 * the hourly re-run idempotent; a ticket re-arms only when it moves or climbs a
 * tier. Cron is gated by QLHS_DISABLE_CRON so tests drive scan() directly.
 */
@Injectable()
export class EscalationScheduler {
  private readonly log = new Logger(EscalationScheduler.name)
  private readonly cfg: EscalationConfig = {
    warnDays: Number(process.env.QLHS_ESCALATE_WARN_DAYS ?? 1),
    criticalOverdueDays: Number(process.env.QLHS_ESCALATE_CRITICAL_DAYS ?? 3),
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly sla: SlaRepo,
    private readonly clock: SystemClock,
    private readonly pauses: SlaPauseRepo,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  scheduled(): Promise<number> {
    if (process.env.QLHS_DISABLE_CRON === '1') return Promise.resolve(0)
    return this.scan().catch((e) => {
      this.log.error(`escalation scan failed: ${String(e)}`)
      return 0
    })
  }

  /** Post due escalations. Returns how many rows were newly inserted. */
  async scan(): Promise<number> {
    const now = this.clock.now()
    const tickets = (await this.prisma.ticket.findMany({
      where: { status: { notIn: OFF_LADDER } },
      select: { id: true, code: true, status: true, flow: true, currentHolderSub: true, statusEnteredAt: true },
    })) as Row[]
    const windows = await this.pauses.windowsFor(tickets)
    const thresholdOf = makeThresholdOf(await this.sla.list())

    let inserted = 0
    for (const t of tickets) {
      if (stationRole(t.status) === null) continue
      const threshold = thresholdOf(t.status, t.flow)
      if (threshold === null) continue
      const since = effectiveEnteredAt(t.statusEnteredAt, windows.get(t.id) ?? [], now)
      const intent = escalationIntent(
        {
          status: t.status,
          overdueDays: overdueDays(since, threshold, now),
          daysLeft: threshold - businessDaysBetween(since, now),
          holderSub: t.currentHolderSub,
        },
        this.cfg,
      )
      if (intent) inserted += await this.post(t, intent)
    }
    return inserted
  }

  private post(t: Row, intent: EscalationIntent): Promise<number> {
    return this.prisma.$executeRaw`
      INSERT INTO notification (ticket_id, code, recipient_sub, recipient_role, kind, waiting_status)
      VALUES (${t.id}, ${t.code}, ${intent.recipientSub}, ${intent.recipientRole}, ${intent.kind}, ${intent.waitingStatus})
      ON CONFLICT (ticket_id, kind, waiting_status)
        WHERE kind IN ('EscalateWarn', 'EscalateOverdue', 'EscalateCritical')
      DO NOTHING`
  }
}

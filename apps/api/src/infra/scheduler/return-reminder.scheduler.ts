import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { TICKET_STATUS } from '@qlhs/contracts'
import { PrismaService } from '../prisma/prisma.service'
import { SlaRepo } from '../prisma/sla/sla.repo'
import { SystemClock } from '../clock/system-clock'
import { isOverdue } from '../../domain/sla/overdue'
import { effectiveEnteredAt } from '../../domain/sla/pause'
import { makeThresholdOf } from '../../domain/admin/overview'
import { SlaPauseRepo } from '../prisma/sla/sla-pause.repo'
import { NOTIFICATION_KIND } from '../../domain/notify/email-template'

/**
 * Enqueues a Return-fixing reminder once a ticket has sat past its threshold
 * (`Return-fixing` = 3 business days, from sla_config — never hardcoded, AD-6).
 * The UNIQUE (ticket, round, kind) makes it one reminder per ticket per round;
 * a new return round (round_no++) can remind again. The dispatcher re-validates
 * the status at send time, so a resubmit between scan and send suppresses it (M4).
 */
@Injectable()
export class ReturnReminderScheduler {
  private readonly log = new Logger(ReturnReminderScheduler.name)

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
      this.log.error(`reminder scan failed: ${String(e)}`)
      return 0
    })
  }

  /** Enqueue reminders for overdue Return-fixing tickets. Returns how many queued. */
  async scan(): Promise<number> {
    const now = this.clock.now()
    const tickets = await this.prisma.ticket.findMany({
      where: { status: TICKET_STATUS.ReturnFixing },
      select: { id: true, flow: true, roundNo: true, applicantSub: true, statusEnteredAt: true },
    })
    // A paused ticket is waiting on purpose — nagging its Applicant would be the
    // exact spam F8 exists to prevent, so the reminder uses the same clock (F8).
    const windows = await this.pauses.windowsFor(tickets)
    const thresholdOf = makeThresholdOf(await this.sla.list())
    let enqueued = 0
    for (const t of tickets) {
      const threshold = thresholdOf(TICKET_STATUS.ReturnFixing, t.flow)
      const since = effectiveEnteredAt(t.statusEnteredAt, windows.get(t.id) ?? [], now)
      if (!isOverdue(since, threshold, now)) continue
      enqueued += await this.prisma.$executeRaw`
        INSERT INTO notification_outbox (ticket_id, round_no, kind, recipient_sub, status)
        VALUES (${t.id}, ${t.roundNo}, ${NOTIFICATION_KIND.ReturnReminder}, ${t.applicantSub}, 'pending')
        ON CONFLICT (ticket_id, round_no, kind) DO NOTHING`
    }
    return enqueued
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ROLE, SYSTEM_SUB, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { PrismaService } from '../prisma/prisma.service'
import { SystemClock } from '../clock/system-clock'
import { TicketTransitionRepo } from '../prisma/ticket/ticket-transition.repo'
import { businessDaysBetween } from '../../domain/sla/business-days'
import { transition } from '../../domain/ticket/transition'
import { NOTIFICATION_KIND } from '../../domain/notify/email-template'

/** Stamped as the Return reason so the Applicant sees WHY it came back (F15). */
const AUTO_RETURN_REASON = 'Tự động trả lại: quá hạn tiếp nhận ở Pool (chưa có DCC1 nào bốc hồ sơ).'

/**
 * Auto-returns a Pool ticket that has sat at `Submitted` (un-picked) longer than
 * the grace window back to its Applicant — so a submission can't rot unseen when
 * no DCC1 picks it up. The window is counted in BUSINESS days from
 * `status_entered_at` (the submit / resubmit instant), the same clock as every
 * SLA badge (AD-6). The transition is the system-only `auto_return` edge, run in
 * DCC1's stead (actor sub = SYSTEM_SUB); it lands straight at `Return-fixing`
 * (no confirm-receipt — no hardcopy ever changed hands). A concurrent pick moves
 * the ticket off `Submitted` first, so the transition then throws and is skipped.
 */
@Injectable()
export class PoolAutoReturnScheduler {
  private readonly log = new Logger(PoolAutoReturnScheduler.name)
  private readonly graceDays = Number(process.env.QLHS_POOL_AUTORETURN_DAYS ?? 4)

  constructor(
    private readonly prisma: PrismaService,
    private readonly transitions: TicketTransitionRepo,
    private readonly clock: SystemClock,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  scheduled(): Promise<number> {
    if (process.env.QLHS_DISABLE_CRON === '1') return Promise.resolve(0)
    return this.scan().catch((e) => {
      this.log.error(`pool auto-return scan failed: ${String(e)}`)
      return 0
    })
  }

  /** Auto-return every over-grace Pool ticket. Returns how many were returned. */
  async scan(): Promise<number> {
    const now = this.clock.now()
    const tickets = await this.prisma.ticket.findMany({
      where: { status: TICKET_STATUS.Submitted },
      select: { id: true, statusEnteredAt: true },
    })
    let returned = 0
    for (const t of tickets) {
      if (businessDaysBetween(t.statusEnteredAt, now) < this.graceDays) continue
      let state
      try {
        state = await this.transitions.apply(t.id, (s) =>
          transition(s, {
            event: TICKET_EVENT.AutoReturn,
            actor: { sub: SYSTEM_SUB, activeRole: ROLE.Dcc1 },
            now,
            reason: AUTO_RETURN_REASON,
          }),
        )
      } catch (e) {
        // A concurrent pick moved it off Submitted between the query and the
        // locked transition — no longer eligible, skip (not an error).
        this.log.warn(`skip auto-return ${t.id}: ${String(e)}`)
        continue
      }
      returned++
      // Landing at Return-fixing fires no email of its own, so tell the Applicant
      // NOW with the same "returned" notice a manual Return sends. Uses the
      // `Returned` kind (NOT `return_reminder`) so it keeps a distinct outbox key
      // and leaves the day-3 return-reminder backstop free to fire. Best-effort +
      // idempotent via UNIQUE(ticket, round, kind).
      try {
        await this.prisma.$executeRaw`
          INSERT INTO notification_outbox (ticket_id, round_no, kind, recipient_sub, status)
          VALUES (${t.id}, ${state.roundNo}, ${NOTIFICATION_KIND.Returned}, ${state.applicantSub}, 'pending')
          ON CONFLICT (ticket_id, round_no, kind) DO NOTHING`
      } catch (e) {
        this.log.warn(`auto-return ${t.id}: notice enqueue failed (backstop covers): ${String(e)}`)
      }
    }
    return returned
  }
}

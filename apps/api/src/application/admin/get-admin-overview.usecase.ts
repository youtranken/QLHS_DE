import { Injectable } from '@nestjs/common'
import { ALL_FLOWS, ROLE, type Role } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { AuditRepo } from '../../infra/prisma/admin/audit.repo'
import { OutboxRepo } from '../../infra/prisma/notify/outbox.repo'
import { SlaPauseRepo } from '../../infra/prisma/sla/sla-pause.repo'
import { SlaClock, startOf } from '../sla/sla-clock'
import { SystemClock } from '../../infra/clock/system-clock'
import { ListUsersUseCase } from './list-users.usecase'
import { makeThresholdOf, summarizeLines, type LineSummary } from '../../domain/admin/overview'

const ELEVATED: readonly string[] = [ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3, ROLE.Admin]

export interface RecentActivity {
  occurredAt: string
  actorSub: string
  actorName: string
  action: string
  code: string | null
  ticketId: string
  flow: string
}

export interface AdminOverviewData {
  users: { total: number; appointed: number; unappointed: number }
  runningTotal: number
  overdueTotal: number
  auditToday: number
  lines: LineSummary[]
  recent: RecentActivity[]
  mailPending: number
  /** F8 — clocks stopped right now. Surfaced on the landing so pause can never
   *  become a quiet habit; the detail lives behind `GET /admin/sla-pauses`. */
  pausedTotal: number
}

/**
 * Admin overview: everything on the console landing, derived at read (AD-6) — no
 * new tables. Users + appointment split (Directory), running/overdue/on-time per
 * line (Ticket + SLA), today's audit volume + recent activity (read-only over
 * ticket_event, AD-4), and mail-queue depth. Admin-only surface (AD-7).
 */
@Injectable()
export class GetAdminOverviewUseCase {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly audit: AuditRepo,
    private readonly outbox: OutboxRepo,
    private readonly pauses: SlaPauseRepo,
    private readonly slaClock: SlaClock,
    private readonly clock: SystemClock,
  ) {}

  async execute(): Promise<AdminOverviewData> {
    const now = this.clock.now()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [users, ticketRows, slaRows, auditToday, recentRows, mailPending, pausedTotal] =
      await Promise.all([
        this.listUsers.execute(),
        this.tickets.listByFlows([...ALL_FLOWS]),
        this.sla.list(),
        this.audit.countSince(startOfDay),
        this.audit.recent(6),
        this.outbox.pendingCount(),
        this.pauses.countOpen(),
      ])

    const nameOf = new Map(users.map((u) => [u.sub, u.fullName ?? u.email ?? u.sub]))
    const appointed = users.filter((u) => u.roles.some((r) => ELEVATED.includes(r))).length

    // Pause-adjusted entry times (F8). Without this the console would call a
    // ticket late that every other screen shows as ⏸ — and the "việc cần làm"
    // panel would send the Admin chasing a wait that was already explained.
    const clock = await this.slaClock.forRows(ticketRows, now)
    const thresholdOf = makeThresholdOf(slaRows)
    const lines = summarizeLines(
      ticketRows.map((t) => ({ flow: t.flow, status: t.status, statusEnteredAt: startOf(clock, t) })),
      [...ALL_FLOWS],
      thresholdOf,
      now,
    )
    const runningTotal = lines.reduce((n, l) => n + l.running, 0)
    const overdueTotal = lines.reduce((n, l) => n + l.overdue, 0)

    const recent: RecentActivity[] = recentRows.map((e) => ({
      occurredAt: e.occurredAt.toISOString(),
      actorSub: e.actorSub,
      actorName: nameOf.get(e.actorSub) ?? e.actorSub,
      action: e.action,
      code: e.code,
      ticketId: e.ticketId,
      flow: e.flow,
    }))

    return {
      users: { total: users.length, appointed, unappointed: users.length - appointed },
      runningTotal,
      overdueTotal,
      auditToday,
      lines,
      recent,
      mailPending,
      pausedTotal,
    }
  }
}

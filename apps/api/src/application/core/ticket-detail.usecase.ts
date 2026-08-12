import { Injectable, Logger } from '@nestjs/common'
import { FLOW, isTerminal, ROLE, type Flow, type Role, type TicketStatus } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { TicketViewRepo } from '../../infra/prisma/ticket/ticket-view.repo'
import { UserDirectoryRepo } from '../../infra/prisma/users/user-directory.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { TicketNotFoundError } from '../../domain/errors'
import { dwellDays, overdueDays } from '../../domain/sla/overdue'
import { SlaClock } from '../sla/sla-clock'
import { SlaPauseRepo } from '../../infra/prisma/sla/sla-pause.repo'
import { businessDaysBetween } from '../../domain/sla/business-days'
import { projectedRoute, displayStation, type RoutePhase } from '../../domain/ticket/route'
import { legalActionsFor, type LegalAction } from './legal-actions.usecase'

export interface RouteStationView {
  status: string
  phase: RoutePhase
  holder: string | null
  enteredAt: string | null
}

export interface TimelineEntry {
  action: string
  fromStatus: string
  toStatus: string
  actorSub: string
  occurredAt: string
  reason: string | null
  dwellDays: number
  /** Processing round this event belongs to — the detail log groups by it so older
   *  rounds collapse behind a toggle. */
  roundNo: number
}

/** F8 — a stopped clock, kept OUT of `timeline`: ticket_event has exactly one
 *  writer (AD-4) and no status changed here, so the trace is merged at read. */
export interface PauseEntry {
  pausedAt: string
  resumedAt: string | null
  reason: string
  pausedBySub: string
  status: string
}

export interface TicketDetail {
  id: string
  code: string | null
  status: string
  flow: string
  priority: string
  documentType: string | null
  description: string | null
  paymentTerm: string | null
  contractNo: string | null
  /** DCC2/DCC3-entered number sent to Accounting (Contract No / Payment No). */
  documentNo: string | null
  projectTeam: string | null
  budgetCode: string | null
  contractor: string | null
  amount: string | null
  currency: string | null
  currentHolderSub: string | null
  roundNo: number
  statusEnteredAt: string
  overdueDays: number
  dwellDays: number
  /** F8 — SLA clock stopped ("chờ bổ sung") + why, so the page explains itself. */
  paused: boolean
  pauseReason: string | null
  isClosed: boolean
  /** The viewer personally holds this ticket (F8 clock-control gate). */
  mine: boolean
  actions: LegalAction[]
  timeline: TimelineEntry[]
  pauses: PauseEntry[]
  route: RouteStationView[]
  /** AD-12 directory: sub → display name for every actor/holder shown here. */
  directory: Record<string, string>
}

@Injectable()
export class TicketDetailUseCase {
  private readonly log = new Logger(TicketDetailUseCase.name)

  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly views: TicketViewRepo,
    private readonly directory: UserDirectoryRepo,
    private readonly clock: SystemClock,
    private readonly slaClock: SlaClock,
    private readonly pauses: SlaPauseRepo,
  ) {}

  async execute(
    ticketId: string,
    viewer: { role: Role | null; sub: string },
    // Read-only callers (e.g. the assistant's whats_next) opt OUT of the seen-mark
    // so merely *asking* about a ticket doesn't clear its "unseen" badge (AD-18).
    opts: { markSeen?: boolean } = {},
  ): Promise<TicketDetail> {
    // Defense-in-depth behind RolesGuard: a role-less viewer never reads.
    if (!viewer.role) throw new TicketNotFoundError(ticketId)
    // Accept either the UUID or the human code — deep-links carry the code (AD-5).
    const t = await this.tickets.findByIdOrCode(ticketId)
    if (!t) throw new TicketNotFoundError(ticketId)
    // H4 IDOR: cross-applicant / cross-flow deep-link → 404, no exists-but-forbidden oracle.
    if (viewer.role === ROLE.Applicant && t.applicantSub !== viewer.sub) {
      throw new TicketNotFoundError(ticketId)
    }
    if (viewer.role === ROLE.Dcc2 && t.flow !== FLOW.Contract) throw new TicketNotFoundError(ticketId)
    if (viewer.role === ROLE.Dcc3 && t.flow !== FLOW.Payment) throw new TicketNotFoundError(ticketId)

    const now = this.clock.now()
    // Opening a ticket marks it seen for this viewer (AD-18) — after the H4 checks
    // so a forbidden deep-link never records a view. Best-effort: a view-write
    // failure must not turn a read into a 500 (code-review #4).
    if (opts.markSeen !== false) {
      await this.views.markViewed(t.id, viewer.sub, now).catch((e) => {
        this.log.warn(`markViewed failed for ${t.id}: ${String(e)}`)
      })
    }
    const threshold = await this.sla.threshold(t.status, t.flow)
    const clock = await this.slaClock.forOne(t, now)
    const events = await this.tickets.timeline(t.id)
    const pauseRows = await this.pauses.listForTicket(t.id)
    const directory = await this.directory.namesForSubs([
      ...events.map((e) => e.actorSub),
      ...pauseRows.map((p) => p.pausedBySub),
      ...(t.currentHolderSub ? [t.currentHolderSub] : []),
    ])

    const timeline: TimelineEntry[] = events.map((e, i) => {
      const next = events[i + 1]
      const end = next ? next.occurredAt : now
      return {
        action: e.action,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorSub: e.actorSub,
        occurredAt: e.occurredAt.toISOString(),
        reason: e.reason,
        dwellDays: businessDaysBetween(e.occurredAt, end),
        roundNo: e.roundNo,
      }
    })

    return {
      id: t.id,
      code: t.code,
      status: t.status,
      flow: t.flow,
      priority: t.priority,
      documentType: t.documentType,
      description: t.description,
      paymentTerm: t.paymentTerm,
      contractNo: t.contractNo,
      documentNo: t.documentNo,
      projectTeam: t.projectTeam,
      budgetCode: t.budgetCode,
      contractor: t.contractor,
      amount: t.amount === null ? null : t.amount.toString(),
      currency: t.currency,
      currentHolderSub: t.currentHolderSub,
      roundNo: t.roundNo,
      statusEnteredAt: t.statusEnteredAt.toISOString(),
      overdueDays: overdueDays(clock.enteredAt, threshold, now),
      dwellDays: dwellDays(clock.enteredAt, now),
      paused: clock.paused,
      pauseReason: clock.pauseReason,
      isClosed: isTerminal(t.status as TicketStatus),
      // The viewer personally holds this ticket → they alone may stop/restart its
      // SLA clock (F8), same rule the board card uses.
      mine: t.currentHolderSub === viewer.sub,
      actions: viewer.role
        ? legalActionsFor(t.status as TicketStatus, viewer.role, t.flow as Flow)
        : [],
      timeline,
      pauses: pauseRows.map((p) => ({
        pausedAt: p.pausedAt.toISOString(),
        resumedAt: p.resumedAt === null ? null : p.resumedAt.toISOString(),
        reason: p.reason,
        pausedBySub: p.pausedBySub,
        status: p.status,
      })),
      route: projectedRoute(t.flow as Flow, t.status as TicketStatus).map((st) => {
        // Match the audit event under its DISPLAY station so Payment's closing
        // `Sent to Accounting` event populates the unified `Completed` node's
        // holder + time (else it renders as an empty "—" finish — F1).
        const entered = events.find(
          (e) => displayStation(t.flow as Flow, e.toStatus as TicketStatus) === st.status,
        )
        return {
          status: st.status,
          phase: st.phase,
          holder: entered?.actorSub ?? null,
          enteredAt: entered?.occurredAt.toISOString() ?? null,
        }
      }),
      directory,
    }
  }
}

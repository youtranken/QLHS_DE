import { Injectable } from '@nestjs/common'
import {
  FLOW, ROLE, TICKET_EVENT, TICKET_STATUS,
  type Flow, type Priority, type Role, type TicketStatus,
} from '@qlhs/contracts'
import { RECONCILE_REASON } from '../../domain/ticket/reconcile'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { LockRepo } from '../../infra/prisma/ticket/lock.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { roleFlows } from '../../domain/dispatch/role-flows'
import { stationsForRole } from '../../domain/dispatch/station-columns'
import { sortPool } from '../../domain/pool/pool-order'
import { overdueDays } from '../../domain/sla/overdue'
import type { DupHint } from '../../domain/ticket/duplicate'
import { ScanDuplicatesUseCase } from '../board/scan-duplicates.usecase'
import { SlaClock, startOf, type ClockState } from '../sla/sla-clock'
import { makeThresholdOf } from '../../domain/admin/overview'
import { legalActionsFor, type LegalAction } from '../core/legal-actions.usecase'

export interface BoardCard {
  id: string
  code: string | null
  contractor: string | null
  amount: string | null
  priority: string
  flow: string
  status: string
  overdueDays: number
  lockedByMe: boolean
  lockedBy: string | null
  actions: LegalAction[]
  /** F12 — suspected duplicates, Pool cards only. Empty = nothing suspicious. */
  dupOf?: DupHint[]
  /** F8 — SLA clock stopped ("chờ bổ sung"); the card shows ⏸ instead of ageing. */
  paused: boolean
  /** F8 — this viewer holds the ticket, so only they may stop/restart its clock. */
  mine: boolean
}
export interface BoardColumn {
  status: string
  overSla: boolean
  cards: BoardCard[]
  /** DCC1-only reconcile lane (2-phase handover bounce): a flag-driven column,
   *  not a real station. Carries its own display label. */
  reconcile?: boolean
  label?: string
}

// Pool action isn't a state-machine edge — the FE routes it to the pool/confirm
// endpoint (AD-9). Prefixed so it can't collide with an event. One click: mint
// the code + advance Submitted → Submitted to VP Andy (DCC1 no longer picks then
// submits in two steps — "Nhận" does both; confirm-flow.repo is atomic so a race
// just fails the second click's transition guard).
const RECEIVE: LegalAction = {
  event: '__confirm' as never,
  label: 'Nhận',
  toStatus: TICKET_STATUS.SubmittedToVpAndy,
  reversible: false,
  reasonRequired: false,
}
// Re-hand over a reconciled (missing-paper) ticket to DCC2 — routed to the
// dedicated resend endpoint, not a state-machine edge (status is unchanged).
const RESEND: LegalAction = {
  event: '__resend' as never,
  label: 'Đã bổ sung, bàn giao lại →',
  toStatus: TICKET_STATUS.SubmittedToDcc2,
  reversible: false,
  reasonRequired: false,
}
// Payment counterpart of RESEND — routes to the DCC3 resend endpoint (Story 4.1).
const RESEND_DCC3: LegalAction = {
  event: '__resend-dcc3' as never,
  label: 'Đã bổ sung, bàn giao lại →',
  toStatus: TICKET_STATUS.SubmittedToDcc3,
  reversible: false,
  reasonRequired: false,
}
// DCC2 "đẩy ngược DCC1" (AC4) — a note, not an edge; DCC1 performs the Return.
const PUSHBACK: LegalAction = {
  event: '__pushback' as never,
  label: 'Đẩy ngược DCC1 (bản cứng sai)',
  toStatus: TICKET_STATUS.ReceivedByDcc2,
  reversible: false,
  reasonRequired: false,
}
// Payment counterpart (H2) — DCC3 pushes back from Received by DCC3; DCC1 Returns.
const PUSHBACK_DCC3: LegalAction = {
  event: '__pushback-dcc3' as never,
  label: 'Đẩy ngược DCC1 (bản cứng sai)',
  toStatus: TICKET_STATUS.ReceivedByDcc3,
  reversible: false,
  reasonRequired: false,
}
// DCC1 clears a pushed-back ticket by Returning it (reason required) — routed to
// the dedicated return-pushback endpoint (clears flag + sendBack atomically).
const RETURN: LegalAction = {
  event: '__return' as never,
  label: 'Trả lại Applicant (Return)',
  toStatus: TICKET_STATUS.Returned,
  reversible: false,
  reasonRequired: true,
}

/** DCC "Trạm của tôi" board: columns (stations) with cards + per-card actions
 *  (AD-17, incl. Pool pick/confirm) + soft-lock state. Scope is server-side. */
@Injectable()
export class StationBoardUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly lock: LockRepo,
    private readonly clock: SystemClock,
    private readonly dupes: ScanDuplicatesUseCase,
    private readonly slaClock: SlaClock,
  ) {}

  async execute(role: Role | null, viewerSub: string): Promise<BoardColumn[]> {
    const flows = roleFlows(role)
    const columns = stationsForRole(role)
    if (flows.length === 0 || columns.length === 0) return []
    const now = this.clock.now()
    // Active work only — the board never shows closed tickets, and must not load
    // them either (closed history grows unbounded; the board must stay flat).
    const all = await this.tickets.listActiveByFlows(flows)
    const clock = await this.slaClock.forRows(all, now)
    // One threshold snapshot for the whole board instead of a findUnique per card.
    const thresholdOf = makeThresholdOf(await this.sla.list())
    // A reconcile-flagged ticket (missing paper OR pushed back for Return) has
    // bounced off DCC2's board into DCC1's reconcile lane below — drop it here.
    const inLane = (r: (typeof all)[number], status: TicketStatus) =>
      r.status === status && !r.reconcileFlag

    const columnsOut = await Promise.all(
      columns.map(async (status) => {
        const at = sortPool(
          all.filter((r) => inLane(r, status)).map((r) => ({ ...r, priority: r.priority as Priority })),
        )
        const cards = await Promise.all(
          at.map((r) =>
            this.toCard(r, status, viewerSub, now, clock, thresholdOf, () =>
              actionsFor(status, role, r.flow as Flow),
            ),
          ),
        )
        return { status, label: columnLabel(role, status), overSla: cards.some((c) => c.overdueDays > 0), cards }
      }),
    )

    await this.attachDupHints(columnsOut, all)
    const reconcile = await this.reconcileLane(role, all, viewerSub, now, clock, thresholdOf)
    return reconcile ? [...columnsOut, reconcile] : columnsOut
  }

  /** F12 — duplicate hints belong to the reception gate only: DCC1 decides at
   *  Pool whether a suspected re-submit goes forward or is Returned. */
  private async attachDupHints(columns: BoardColumn[], all: Awaited<ReturnType<TicketQueryRepo['listByFlows']>>): Promise<void> {
    const pool = columns.find((c) => c.status === TICKET_STATUS.Submitted)
    if (!pool || pool.cards.length === 0) return
    const ids = new Set(pool.cards.map((c) => c.id))
    const hints = await this.dupes.forSubjects(all.filter((r) => ids.has(r.id)))
    for (const card of pool.cards) card.dupOf = hints.get(card.id) ?? []
  }

  /** DCC1's flag-driven "chờ đối chiếu" lane: tickets DCC2 bounced back. The
   *  per-card action depends on WHY — re-hand over (missing paper) or Return
   *  (pushed back). Absent for other roles or when nothing is flagged. */
  private async reconcileLane(
    role: Role | null,
    all: Awaited<ReturnType<TicketQueryRepo['listByFlows']>>,
    viewerSub: string,
    now: Date,
    clock: Map<string, ClockState>,
    thresholdOf: (status: string, flow: string) => number | null,
  ): Promise<BoardColumn | null> {
    if (role !== ROLE.Dcc1 && role !== ROLE.Admin) return null
    const flagged = sortPool(
      all.filter((r) => r.reconcileFlag).map((r) => ({ ...r, priority: r.priority as Priority })),
    )
    if (flagged.length === 0) return null
    const cards = await Promise.all(
      flagged.map((r) => {
        const action = reconcileAction(r.reconcileReason, r.flow as Flow)
        return this.toCard(r, r.status as TicketStatus, viewerSub, now, clock, thresholdOf, () => [action])
      }),
    )
    return {
      status: TICKET_STATUS.SubmittedToDcc2,
      reconcile: true,
      label: 'Chờ đối chiếu (DCC2/DCC3 báo thiếu giấy / đẩy ngược)',
      overSla: cards.some((c) => c.overdueDays > 0),
      cards,
    }
  }

  private async toCard(
    r: Awaited<ReturnType<TicketQueryRepo['listByFlows']>>[number],
    status: TicketStatus,
    viewerSub: string,
    now: Date,
    clock: Map<string, ClockState>,
    thresholdOf: (status: string, flow: string) => number | null,
    actionsOf: (lockedByMe: boolean) => LegalAction[],
  ): Promise<BoardCard> {
    const threshold = thresholdOf(status, r.flow)
    const lk = await this.lock.get(r.id)
    const live = lk !== null && lk.expiresAt.getTime() > now.getTime()
    const lockedByMe = live && lk?.holderSub === viewerSub
    return {
      id: r.id,
      code: r.code,
      contractor: r.contractor,
      amount: r.amount === null ? null : r.amount.toString(),
      priority: r.priority,
      flow: r.flow,
      status,
      overdueDays: overdueDays(startOf(clock, r), threshold, now),
      paused: clock.get(r.id)?.paused ?? false,
      mine: r.currentHolderSub === viewerSub,
      lockedByMe,
      lockedBy: live && !lockedByMe ? (lk?.holderSub ?? null) : null,
      actions: actionsOf(lockedByMe),
    }
  }
}

/** The single reconcile-lane action for a flagged ticket, by why + flow: Return
 *  (pushed back), or re-hand over to DCC2 (Contract) / DCC3 (Payment). */
function reconcileAction(reason: string | null, flow: Flow): LegalAction {
  if (reason === RECONCILE_REASON.ReturnRequested) return RETURN
  return flow === FLOW.Payment ? RESEND_DCC3 : RESEND
}

function actionsFor(
  status: TicketStatus,
  role: Role | null,
  flow: Flow,
): LegalAction[] {
  // At the Pool gate DCC1 either takes the ticket in ("Nhận" → mint code +
  // advance) or Returns it (F12 duplicate, wrong doc type — FR-15). The Return is
  // derived from the machine, not hardcoded, so the edge stays the single truth
  // (AD-17). No pick step: "Nhận" goes straight to Submitted to VP Andy.
  if (status === TICKET_STATUS.Submitted) {
    const back = role ? legalActionsFor(status, role, flow).filter((a) => a.event === TICKET_EVENT.SendBack) : []
    return [RECEIVE, ...back]
  }
  if (!role) return []
  const actions = legalActionsFor(status, role, flow)
  // AC4: give DCC2 a push-back option wherever it physically holds the hardcopy.
  if (role === ROLE.Dcc2 && (status === TICKET_STATUS.ReceivedByDcc2 || status === TICKET_STATUS.Hardcopy)) {
    return [...actions, PUSHBACK]
  }
  // H2: symmetric DCC3 push-back from Received by DCC3 (before Payment closes).
  if (role === ROLE.Dcc3 && status === TICKET_STATUS.ReceivedByDcc3) {
    return [...actions, PUSHBACK_DCC3]
  }
  return actions
}

/** Per-role column header override (AD-16 — one status, differently-named tabs).
 *  DCC1 sees the ACC step as its "Chờ ACC" queue; DCC2 sees the canonical name. */
function columnLabel(role: Role | null, status: TicketStatus): string | undefined {
  if (
    (role === ROLE.Dcc1 || role === ROLE.Admin) &&
    status === TICKET_STATUS.SubmittedToAccounting
  ) {
    return 'Chờ ACC'
  }
  return undefined
}

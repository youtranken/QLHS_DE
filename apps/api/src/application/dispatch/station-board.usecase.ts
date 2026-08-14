import { Injectable } from '@nestjs/common'
import {
  FLOW, ROLE, TICKET_EVENT, TICKET_STATUS,
  type Flow, type Priority, type Role, type TicketStatus,
} from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { LockRepo } from '../../infra/prisma/ticket/lock.repo'
import { OptionRepo, type DocTypeCapabilities } from '../../infra/prisma/admin/option.repo'
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
  /** Loại hồ sơ (document type) — dùng cho batch DCC3 hiện cột "Loại" mỗi dòng. */
  documentType: string | null
  /** Contract No do applicant nhập lúc tạo (tham chiếu, luồng Payment) — batch DCC3
   *  hiện kèm để đối chiếu; DCC3 nhập payment_no riêng. */
  contractNo: string | null
  amount: string | null
  priority: string
  flow: string
  status: string
  /** Round counter — 0 on the first pass; a heavy return bumps it. The DCC2
   *  "Skip to Completed" is offered only on round 0 (a re-entered Contract already
   *  carries a real Contract No a blank skip would clobber). */
  roundNo: number
  /** Cờ ga Received by DCC2 (chỉ loại luồng Contract) — web quyết định popup ở đây:
   *  requiresContractNo → ô Contract No bắt buộc; allowSkip → checkbox Skip. Cả hai
   *  tắt → gửi thẳng, không popup. */
  requiresContractNo: boolean
  allowSkip: boolean
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
  /** Reconcile lane only — the free-text reason DCC2/DCC3 gave (missing/wrong paper),
   *  shown on the card so DCC1 reads it without opening the ticket. */
  reconcileComment?: string | null
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
  label: 'Đã bổ sung, gửi lại →',
  toStatus: TICKET_STATUS.SubmittedToDcc2,
  reversible: false,
  reasonRequired: false,
}
// Payment counterpart of RESEND — routes to the DCC3 resend endpoint (Story 4.1).
const RESEND_DCC3: LegalAction = {
  event: '__resend-dcc3' as never,
  label: 'Đã bổ sung, gửi lại →',
  toStatus: TICKET_STATUS.SubmittedToDcc3,
  reversible: false,
  reasonRequired: false,
}
// DCC1 Returns a reconcile-flagged ticket (reason required) — routed to the
// dedicated return-pushback endpoint (clears flag + heavy sendBack atomically).
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
    private readonly options: OptionRepo,
  ) {}

  private static readonly NO_CAPS: DocTypeCapabilities = { requiresContractNo: false, allowSkip: false }

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
    // One capability snapshot (Contract doc types) instead of a lookup per card —
    // skip the query entirely for a board whose role never sees Contract (e.g. DCC3).
    const capsMap = flows.includes(FLOW.Contract)
      ? await this.options.contractCapabilityMap()
      : new Map<string, DocTypeCapabilities>()
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
            this.toCard(r, status, viewerSub, now, clock, thresholdOf, capsMap, () =>
              actionsFor(status, role, r.flow as Flow),
            ),
          ),
        )
        return { status, label: columnLabel(role, status), overSla: cards.some((c) => c.overdueDays > 0), cards }
      }),
    )

    await this.attachDupHints(columnsOut, all)
    const reconcile = await this.reconcileLane(role, all, viewerSub, now, clock, thresholdOf, capsMap)
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

  /** DCC1's flag-driven "chờ kiểm tra lại" lane: tickets DCC2/DCC3 bounced back
   *  at receipt (missing/wrong hardcopy). Each card offers BOTH ways out — re-hand
   *  over (supplement & resend) as the primary button, and Return to the Applicant
   *  in the ⋯ menu. Absent for other roles or when nothing is flagged. */
  private async reconcileLane(
    role: Role | null,
    all: Awaited<ReturnType<TicketQueryRepo['listByFlows']>>,
    viewerSub: string,
    now: Date,
    clock: Map<string, ClockState>,
    thresholdOf: (status: string, flow: string) => number | null,
    capsMap: Map<string, DocTypeCapabilities>,
  ): Promise<BoardColumn | null> {
    if (role !== ROLE.Dcc1 && role !== ROLE.Admin) return null
    const flagged = sortPool(
      all.filter((r) => r.reconcileFlag).map((r) => ({ ...r, priority: r.priority as Priority })),
    )
    if (flagged.length === 0) return null
    const comments = await this.tickets.reconcileComments(flagged.map((r) => r.id))
    const cards = await Promise.all(
      flagged.map(async (r) => {
        const actions = reconcileActions(r.flow as Flow)
        const card = await this.toCard(r, r.status as TicketStatus, viewerSub, now, clock, thresholdOf, capsMap, () => actions)
        return { ...card, reconcileComment: comments.get(r.id) ?? null }
      }),
    )
    return {
      status: TICKET_STATUS.SubmittedToDcc2,
      reconcile: true,
      label: 'DCC2/DCC3 báo thiếu giấy – cần kiểm tra lại',
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
    capsMap: Map<string, DocTypeCapabilities>,
    actionsOf: (lockedByMe: boolean) => LegalAction[],
  ): Promise<BoardCard> {
    const threshold = thresholdOf(status, r.flow)
    const lk = await this.lock.get(r.id)
    const live = lk !== null && lk.expiresAt.getTime() > now.getTime()
    const lockedByMe = live && lk?.holderSub === viewerSub
    const caps = (r.documentType && capsMap.get(r.documentType)) || StationBoardUseCase.NO_CAPS
    return {
      id: r.id,
      code: r.code,
      contractor: r.contractor,
      documentType: r.documentType,
      contractNo: r.contractNo,
      amount: r.amount === null ? null : r.amount.toString(),
      priority: r.priority,
      flow: r.flow,
      status,
      roundNo: r.roundNo,
      requiresContractNo: caps.requiresContractNo,
      allowSkip: caps.allowSkip,
      overdueDays: overdueDays(startOf(clock, r), threshold, now),
      paused: clock.get(r.id)?.paused ?? false,
      mine: r.currentHolderSub === viewerSub,
      lockedByMe,
      lockedBy: live && !lockedByMe ? (lk?.holderSub ?? null) : null,
      actions: actionsOf(lockedByMe),
    }
  }
}

/** Both ways out of the reconcile lane, DCC1's call: re-hand over (supplement &
 *  resend to DCC2/DCC3, primary) OR Return the ticket to the Applicant (⋯ menu).
 *  splitActions promotes the safe resend to the button and keeps Return in ⋯. */
function reconcileActions(flow: Flow): LegalAction[] {
  const resend = flow === FLOW.Payment ? RESEND_DCC3 : RESEND
  return [resend, RETURN]
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
  // No after-receipt push-back: a wrong/incomplete hardcopy is caught by DCC2/DCC3
  // AT RECEIPT (the "missing paper" report on the handover modal), which flags the
  // ticket into DCC1's reconcile lane. Once a DCC confirms receipt it has accepted
  // the paper — nothing bounces back from Received-by-DCC2/DCC3 or Hardcopy.
  return legalActionsFor(status, role, flow)
}

/** Per-role column header override (AD-16 — one status, differently-named tabs).
 *  DCC1 sees the ACC step as its "Chờ ACC" queue; DCC2 sees the canonical name. */
function columnLabel(role: Role | null, status: TicketStatus): string | undefined {
  if (
    (role === ROLE.Dcc1 || role === ROLE.Admin) &&
    status === TICKET_STATUS.SubmittedToAccounting
  ) {
    return 'Waiting for ACC'
  }
  return undefined
}

import { Injectable } from '@nestjs/common'
import { FLOW, TICKET_EVENT, TICKET_STATUS, TERMINAL_STATUSES } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "My tickets" stays capped (a personal list is naturally small); the in-flight
// board/pool lists are bounded by live work. Closed lookup is the one list that
// grows without bound over the years, so it uses keyset pagination instead of a
// flat cap — see searchClosed.
const MAX_MY_TICKETS = 1000

export interface ClosedFilters {
  code?: string
  contractor?: string
  contractNo?: string
  applicant?: string
  from?: Date
  to?: Date
}

/** Keyset cursor for closed-ticket paging: the (closed-at, id) of the last row
 *  already seen. Ordering is (statusEnteredAt DESC, id DESC), so the next page is
 *  everything strictly "before" this point — O(1) regardless of how deep you page
 *  (unlike OFFSET, which re-scans and discards every skipped row). */
export interface ClosedCursor {
  statusEnteredAt: Date
  id: string
}

/** Ticket reads only — owner-scoped queries (isolation base, AD-7), pool/board
 *  listings, closed lookup and audit timeline. Writes live in TicketWriteRepo. */
@Injectable()
export class TicketQueryRepo {
  constructor(private readonly prisma: PrismaService) {}

  findByIdForApplicant(id: string, applicantSub: string) {
    return this.prisma.ticket.findFirst({ where: { id, applicantSub } })
  }

  listByApplicant(applicantSub: string) {
    return this.prisma.ticket.findMany({
      where: { applicantSub },
      orderBy: { createdAt: 'desc' },
      take: MAX_MY_TICKETS,
    })
  }

  /** Every ticket sitting in the Pool (Submitted), any flow — DCC1's inbox. */
  listPool() {
    return this.prisma.ticket.findMany({ where: { status: TICKET_STATUS.Submitted } })
  }

  /**
   * Candidate pool for duplicate detection (F12): everything still in flight,
   * plus anything closed inside the tier-2 window. Cancelled is excluded at the
   * query — a withdrawn ticket is never evidence of a double-submit.
   */
  listDuplicateCandidates(since: Date) {
    return this.prisma.ticket.findMany({
      where: {
        status: { not: TICKET_STATUS.Cancelled },
        OR: [
          { status: { notIn: [TICKET_STATUS.Completed, TICKET_STATUS.SentToAccounting] } },
          { createdAt: { gte: since } },
        ],
      },
      select: {
        id: true, code: true, status: true, flow: true, documentType: true,
        contractNo: true, projectTeam: true, contractor: true, amount: true,
        currency: true, createdAt: true,
      },
    })
  }

  /** Tickets this person personally holds right now (F11 digest, AD-7 by sub). */
  listHeldBy(sub: string) {
    return this.prisma.ticket.findMany({
      where: { currentHolderSub: sub },
      orderBy: { statusEnteredAt: 'asc' },
    })
  }

  findById(id: string) {
    return this.prisma.ticket.findUnique({ where: { id } })
  }

  /** Resolve a deep-link that may carry either the UUID or the human code
   *  (`openTicketDetail(idOrCode)` / EXPERIENCE deep-link-by-code). A code never
   *  matches the UUID shape, so the branch is unambiguous — no id/code collision. */
  findByIdOrCode(idOrCode: string) {
    return UUID_RE.test(idOrCode)
      ? this.prisma.ticket.findUnique({ where: { id: idOrCode } })
      : this.prisma.ticket.findFirst({ where: { code: idOrCode } })
  }

  listByFlows(flows: string[]) {
    return this.prisma.ticket.findMany({ where: { flow: { in: flows } } })
  }

  /**
   * In-flight tickets only — the "Trạm của tôi" board never shows closed work, so
   * it must not LOAD it either: without the terminal-status filter every board
   * render would drag the whole closed history (grows unbounded over the years).
   * Backed by a partial index on non-terminal rows so the scan touches only live
   * work regardless of how large the closed pile gets. (dispatch-map/analytics
   * keep listByFlows — they legitimately count the Completed station.)
   */
  listActiveByFlows(flows: string[]) {
    return this.prisma.ticket.findMany({
      where: { flow: { in: flows }, status: { notIn: [...TERMINAL_STATUSES] } },
    })
  }

  /**
   * Which of these numbers are already taken — the read side of the batch
   * send-to-Accounting pre-flight so DCC2/DCC3 see a clash BEFORE sending anything
   * (the DB partial-unique index stays the final TOCTOU guard). Scoped to the flow
   * that is entering: DCC2 (Contract) tests contract_no; DCC3 (Payment) tests
   * payment_no. Mirrors the per-flow unique index — a Cancelled ticket releases its
   * number, so it never counts as taken.
   */
  async existingDocumentNos(documentNos: string[], flow: string): Promise<string[]> {
    const trimmed = [...new Set(documentNos.map((n) => n.trim()).filter(Boolean))]
    if (trimmed.length === 0) return []
    const notCancelled = { not: TICKET_STATUS.Cancelled }
    if (flow === FLOW.Payment) {
      const rows = await this.prisma.ticket.findMany({
        where: { flow, status: notCancelled, paymentNo: { in: trimmed } },
        select: { paymentNo: true },
      })
      return rows.map((r) => r.paymentNo).filter((n): n is string => n !== null)
    }
    // Contract No is stored uppercase, so probe uppercase to mirror the write path +
    // the unique index (a non-FE client may send mixed case).
    const wanted = trimmed.map((n) => n.toUpperCase())
    const rows = await this.prisma.ticket.findMany({
      where: { flow, status: notCancelled, contractNo: { in: wanted } },
      select: { contractNo: true },
    })
    return rows.map((r) => r.contractNo).filter((n): n is string => n !== null)
  }

  listByStatuses(statuses: string[]) {
    return this.prisma.ticket.findMany({
      where: { status: { in: statuses } },
      orderBy: { statusEnteredAt: 'asc' },
    })
  }

  /**
   * FR-17 lookup surface: reopenable closed tickets within the caller's flow scope
   * (AD-7/AD-16 — enforced HERE, never on the FE), narrowed by optional filters.
   * "Closed" = Completed (General/Contract) OR Sent to Accounting (Payment, H5) —
   * both reopenable; Cancelled is dead and excluded. Ordered newest-closed first.
   */
  searchClosed(flows: string[], f: ClosedFilters, page: { limit: number; cursor?: ClosedCursor }) {
    const contains = (v?: string) =>
      v && v.trim() ? { contains: v.trim(), mode: 'insensitive' as const } : undefined
    const dateRange =
      f.from || f.to ? { gte: f.from ?? undefined, lte: f.to ?? undefined } : undefined
    // Keyset: "strictly before (closed-at, id)" for a DESC,DESC order. The id tie
    // break makes paging deterministic when two tickets closed the same instant.
    const keyset = page.cursor
      ? {
          OR: [
            { statusEnteredAt: { lt: page.cursor.statusEnteredAt } },
            { statusEnteredAt: page.cursor.statusEnteredAt, id: { lt: page.cursor.id } },
          ],
        }
      : {}
    return this.prisma.ticket.findMany({
      where: {
        status: { in: [TICKET_STATUS.Completed, TICKET_STATUS.SentToAccounting] },
        flow: { in: flows },
        code: contains(f.code),
        contractor: contains(f.contractor),
        contractNo: contains(f.contractNo),
        applicantSub: contains(f.applicant),
        createdAt: dateRange,
        ...keyset,
      },
      orderBy: [{ statusEnteredAt: 'desc' }, { id: 'desc' }],
      // +1 sentinel row so the caller can tell "there's more" without a count.
      take: page.limit + 1,
    })
  }

  timeline(ticketId: string) {
    return this.prisma.ticketEvent.findMany({
      where: { ticketId },
      orderBy: { occurredAt: 'asc' },
    })
  }

  /**
   * Latest reconcile comment per ticket — the free-text reason DCC2/DCC3 typed
   * when reporting missing paper or pushing a wrong hardcopy back. Shown on the
   * DCC1 reconcile-lane card so DCC1 sees WHY without opening each ticket.
   */
  async reconcileComments(ticketIds: string[]): Promise<Map<string, string>> {
    if (ticketIds.length === 0) return new Map()
    const rows = await this.prisma.ticketEvent.findMany({
      where: {
        ticketId: { in: ticketIds },
        action: { in: [TICKET_EVENT.MissingPaperFlagged, TICKET_EVENT.ReturnRequested] },
        reason: { not: null },
      },
      orderBy: { occurredAt: 'desc' },
      select: { ticketId: true, reason: true },
    })
    const latest = new Map<string, string>()
    for (const r of rows) if (r.reason && !latest.has(r.ticketId)) latest.set(r.ticketId, r.reason)
    return latest
  }

  /**
   * Most recent STATUS-changing transition — the Undo candidate (AD-19). Skips
   * audit-only notes (created / priority_changed / field_changed / reopen_requested
   * / pool_picked / lock_seized) so an interleaved note can't shadow the reversible
   * move within the undo window.
   */
  lastTransitionEvent(ticketId: string) {
    return this.prisma.ticketEvent.findFirst({
      where: {
        ticketId,
        action: {
          notIn: [
            TICKET_EVENT.Created,
            TICKET_EVENT.PriorityChanged,
            TICKET_EVENT.FieldChanged,
            TICKET_EVENT.ReopenRequested,
            TICKET_EVENT.PoolPicked,
            TICKET_EVENT.LockSeized,
            TICKET_EVENT.MissingPaperFlagged,
            TICKET_EVENT.MissingPaperCleared,
            TICKET_EVENT.ReturnRequested,
          ],
        },
      },
      orderBy: { occurredAt: 'desc' },
    })
  }
}

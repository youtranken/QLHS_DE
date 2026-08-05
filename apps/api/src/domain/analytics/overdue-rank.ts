import { isTerminal, type TicketStatus } from '@qlhs/contracts'
import { overdueDays } from '../sla/overdue'

export interface OverdueInput {
  id: string
  code: string | null
  flow: string
  status: string
  /** Pause-adjusted status-entry time (SlaClock) — same basis as every badge. */
  enteredAt: Date
  holderSub: string | null
}

export interface OverdueRanked {
  id: string
  code: string | null
  flow: string
  status: string
  overdueDays: number
  holderSub: string | null
}

/**
 * The N most-overdue running tickets, worst first. Terminal tickets carry no SLA
 * (PRD §8.2) so they never rank; ties break by code for a stable list.
 */
export function topOverdue(
  rows: readonly OverdueInput[],
  thresholdOf: (status: string, flow: string) => number | null,
  now: Date,
  limit: number,
): OverdueRanked[] {
  return rows
    .filter((r) => !isTerminal(r.status as TicketStatus))
    .map((r) => ({
      id: r.id,
      code: r.code,
      flow: r.flow,
      status: r.status,
      holderSub: r.holderSub,
      overdueDays: overdueDays(r.enteredAt, thresholdOf(r.status, r.flow), now),
    }))
    .filter((r) => r.overdueDays > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays || (a.code ?? '').localeCompare(b.code ?? ''))
    .slice(0, limit)
}

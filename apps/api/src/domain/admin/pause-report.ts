import { pausedBusinessDays } from '../sla/pause'

/**
 * F8 oversight. Pausing the SLA clock is the one action in QLHS that makes a
 * ticket look better without anyone doing work on it, so it needs a place where
 * it is visible: an Admin who can see WHERE pause is being leaned on, and WHICH
 * clocks have been stopped far too long, is the whole abuse control. There is no
 * new table — every number below is derived at read from `ticket_sla_pause`.
 */

/** Business days after which a still-open pause stops looking like "chờ bổ sung". */
export const STALE_PAUSE_DAYS = 5

export interface PauseRow {
  ticketId: string
  code: string | null
  /** The station the clock was stopped at, captured when the pause opened — a
   *  resumed ticket has since moved on, so today's status would misattribute it. */
  status: string
  flow: string
  reason: string
  pausedBySub: string
  pausedAt: Date
  resumedAt: Date | null
}

export interface OpenPauseView {
  ticketId: string
  code: string | null
  status: string
  flow: string
  reason: string
  pausedBySub: string
  pausedAt: Date
  pausedDays: number
  stale: boolean
}

export interface StationPauseStat {
  status: string
  /** Pause events, not tickets: the same ticket paused twice is two events. */
  pauses: number
  tickets: number
  openNow: number
  longestDays: number
}

function spanDays(r: PauseRow, now: Date): number {
  return pausedBusinessDays([{ from: r.pausedAt, to: r.resumedAt }], now)
}

/** Clocks stopped right now, longest wait first — the top row is the one to chase. */
export function openPauses(rows: readonly PauseRow[], now: Date): OpenPauseView[] {
  return rows
    .filter((r) => r.resumedAt === null)
    .map((r) => {
      const pausedDays = spanDays(r, now)
      return {
        ticketId: r.ticketId,
        code: r.code,
        status: r.status,
        flow: r.flow,
        reason: r.reason,
        pausedBySub: r.pausedBySub,
        pausedAt: r.pausedAt,
        pausedDays,
        stale: pausedDays >= STALE_PAUSE_DAYS,
      }
    })
    .sort((a, b) => b.pausedDays - a.pausedDays || a.pausedAt.getTime() - b.pausedAt.getTime())
}

/** How hard each station leans on pause, busiest first. */
export function pausesByStation(rows: readonly PauseRow[], now: Date): StationPauseStat[] {
  const byStatus = new Map<string, { tickets: Set<string>; pauses: number; openNow: number; longestDays: number }>()
  for (const r of rows) {
    const acc = byStatus.get(r.status) ?? { tickets: new Set<string>(), pauses: 0, openNow: 0, longestDays: 0 }
    acc.tickets.add(r.ticketId)
    acc.pauses += 1
    if (r.resumedAt === null) acc.openNow += 1
    acc.longestDays = Math.max(acc.longestDays, spanDays(r, now))
    byStatus.set(r.status, acc)
  }
  return [...byStatus.entries()]
    .map(([status, a]) => ({
      status,
      pauses: a.pauses,
      tickets: a.tickets.size,
      openNow: a.openNow,
      longestDays: a.longestDays,
    }))
    .sort((a, b) => b.pauses - a.pauses || a.status.localeCompare(b.status))
}

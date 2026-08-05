import { addBusinessDays, businessDaysBetween } from './business-days'

/**
 * F8 — "chờ bổ sung": the SLA clock stops while a ticket waits on something
 * outside the office (a contractor's original paper, a counter-signature). The
 * ticket does NOT change status — a pause is not a station — so nothing here
 * touches the state machine. Instead the SLA start is shifted forward by the
 * paused time, and every derived number (dwell, overdue, badge) follows from
 * that single substitution.
 */
export interface PauseWindow {
  from: Date
  /** null = still paused; the clock is stopped up to "now". */
  to: Date | null
}

/**
 * Business days the clock spent stopped, up to `now`.
 *
 * Deliberately measured in whole days, not hours: a pause that runs into the
 * next working day counts 1 and upwards (decision 2026-07-26). The known cost
 * is that an overnight pause forgives a full day for minutes of real waiting —
 * accepted, with the Admin pause report as the counterweight.
 */
export function pausedBusinessDays(windows: readonly PauseWindow[], now: Date): number {
  const nowMs = now.getTime()
  // Normalize each window to [from, end] clamped at `now`; drop future-dated or
  // zero-length rows (clock skew must never hand back SLA days).
  const intervals: [number, number][] = []
  for (const w of windows) {
    const from = w.from.getTime()
    const end = Math.min((w.to ?? now).getTime(), nowMs)
    if (end > from) intervals.push([from, end])
  }
  if (intervals.length === 0) return 0

  // Merge overlaps before counting so two overlapping pauses (bad/repaired data,
  // since PauseStateError blocks it in the normal path) forgive real days once.
  intervals.sort((a, b) => a[0] - b[0])
  let total = 0
  let [curFrom, curEnd] = intervals[0]!
  for (let i = 1; i < intervals.length; i++) {
    const [from, end] = intervals[i]!
    if (from <= curEnd) curEnd = Math.max(curEnd, end)
    else {
      total += businessDaysBetween(new Date(curFrom), new Date(curEnd))
      ;[curFrom, curEnd] = [from, end]
    }
  }
  return total + businessDaysBetween(new Date(curFrom), new Date(curEnd))
}

/**
 * The instant SLA should treat as "entered this station". Feed this to
 * `dwellDays`/`overdueDays`/`isOverdue` instead of the raw `statusEnteredAt`
 * and paused time is excluded everywhere at once.
 */
export function effectiveEnteredAt(
  statusEnteredAt: Date,
  windows: readonly PauseWindow[],
  now: Date,
): Date {
  // Clamp each window's start to this station's entry: a pause that opened at a
  // prior station must only forgive the part that overlaps THIS station, never
  // shift a clock backwards into time the ticket didn't spend here.
  const floor = statusEnteredAt.getTime()
  const scoped = windows.map((w) =>
    w.from.getTime() < floor ? { from: statusEnteredAt, to: w.to } : w,
  )
  return addBusinessDays(statusEnteredAt, pausedBusinessDays(scoped, now))
}

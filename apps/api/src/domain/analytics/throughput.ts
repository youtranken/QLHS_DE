import { TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { type AnalyticsEvent } from './types'
import { periodKey, type Granularity } from './period'

/** A ticket is "cleared" when it reaches a done outcome — Completed (General/
 *  Contract) or Sent to Accounting (Payment close). Cancelled is an abort, not
 *  throughput, so it is deliberately excluded. */
const DONE_STATUSES: ReadonlySet<string> = new Set([
  TICKET_STATUS.Completed,
  TICKET_STATUS.SentToAccounting,
])

export interface ThroughputBucket {
  period: string
  created: number
  completed: number
}

/**
 * Tickets created vs. cleared per calendar period (week or month), oldest first.
 * Both counts derive from audit rows: `created` from the Created action, so a
 * ticket is counted once even if it re-enters the flow; `completed` from a done
 * to-status.
 */
export function throughputByPeriod(
  events: readonly AnalyticsEvent[],
  granularity: Granularity,
): ThroughputBucket[] {
  const acc = new Map<string, { created: number; completed: number }>()
  const bump = (period: string, field: 'created' | 'completed') => {
    const b = acc.get(period) ?? { created: 0, completed: 0 }
    b[field] += 1
    acc.set(period, b)
  }
  for (const e of events) {
    const period = periodKey(e.occurredAt, granularity)
    if (e.action === TICKET_EVENT.Created) bump(period, 'created')
    if (DONE_STATUSES.has(e.toStatus)) bump(period, 'completed')
  }
  return [...acc.entries()]
    .map(([period, b]) => ({ period, ...b }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

/** Same output as throughputByPeriod but from pre-grouped rows (SQL does the
 *  period bucketing + counts). Kept as the tested contract; the SQL path must
 *  agree with throughputByPeriod on the same events (admin-analytics e2e). */
export function throughputFromBuckets(buckets: readonly ThroughputBucket[]): ThroughputBucket[] {
  return [...buckets].sort((a, b) => a.period.localeCompare(b.period))
}

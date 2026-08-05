import { describe, it, expect } from 'vitest'
import { throughputByPeriod } from './throughput'
import type { AnalyticsEvent } from './types'

const ev = (over: Partial<AnalyticsEvent>): AnalyticsEvent => ({
  ticketId: 't1',
  flow: 'general',
  action: 'x',
  fromStatus: '',
  toStatus: 'Submitted',
  occurredAt: new Date('2026-07-01T00:00:00Z'),
  ...over,
})

describe('throughputByPeriod', () => {
  it('counts created vs completed per month, oldest first', () => {
    const events = [
      ev({ action: 'created', occurredAt: new Date('2026-06-10T00:00:00Z') }),
      ev({ action: 'created', occurredAt: new Date('2026-07-02T00:00:00Z') }),
      ev({ action: 'andyApproveComplete', toStatus: 'Completed', occurredAt: new Date('2026-07-05T00:00:00Z') }),
      ev({ action: 'sendToAccounting', toStatus: 'Sent to Accounting', occurredAt: new Date('2026-07-06T00:00:00Z') }),
    ]
    expect(throughputByPeriod(events, 'month')).toEqual([
      { period: '2026-06', created: 1, completed: 0 },
      { period: '2026-07', created: 1, completed: 2 },
    ])
  })

  it('excludes Cancelled from completed', () => {
    const events = [
      ev({ action: 'created', occurredAt: new Date('2026-07-01T00:00:00Z') }),
      ev({ action: 'cancel', toStatus: 'Cancelled', occurredAt: new Date('2026-07-05T00:00:00Z') }),
    ]
    // The month exists (a ticket was created) but the abort adds nothing to completed.
    expect(throughputByPeriod(events, 'month')).toEqual([{ period: '2026-07', created: 1, completed: 0 }])
  })
})

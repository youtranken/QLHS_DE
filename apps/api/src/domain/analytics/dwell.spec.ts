import { describe, it, expect } from 'vitest'
import { dwellSegments, dwellByStatus, dwellHeatmap } from './dwell'
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

const at = (iso: string) => new Date(iso)

describe('dwellSegments', () => {
  it('attributes each gap to the status the ticket sat in', () => {
    const events = [
      ev({ toStatus: 'Submitted', occurredAt: at('2026-07-01T00:00:00Z') }),
      ev({ toStatus: 'Submitted to VP Andy', occurredAt: at('2026-07-03T00:00:00Z') }),
      ev({ toStatus: 'Completed', occurredAt: at('2026-07-04T00:00:00Z') }),
    ]
    const segs = dwellSegments(events)
    // Submitted for 2 days, then Submitted to VP Andy for 1 day. Completed accrues none.
    expect(segs).toEqual([
      { status: 'Submitted', flow: 'general', ms: 2 * 86_400_000 },
      { status: 'Submitted to VP Andy', flow: 'general', ms: 1 * 86_400_000 },
    ])
  })

  it('sorts out-of-order events per ticket and never mixes two tickets', () => {
    const events = [
      ev({ ticketId: 'a', toStatus: 'Submitted', occurredAt: at('2026-07-03T00:00:00Z') }),
      ev({ ticketId: 'a', toStatus: 'X', occurredAt: at('2026-07-01T00:00:00Z') }),
      ev({ ticketId: 'b', toStatus: 'Submitted', occurredAt: at('2026-07-01T00:00:00Z') }),
    ]
    const segs = dwellSegments(events)
    // Ticket a: X (2 days) then Submitted open. Ticket b: single event, no gap.
    expect(segs).toEqual([{ status: 'X', flow: 'general', ms: 2 * 86_400_000 }])
  })

  it('drops zero/negative gaps (same-instant events)', () => {
    const events = [
      ev({ toStatus: 'Submitted', occurredAt: at('2026-07-01T00:00:00Z') }),
      ev({ toStatus: 'Reopened', occurredAt: at('2026-07-01T00:00:00Z') }),
    ]
    expect(dwellSegments(events)).toEqual([])
  })
})

describe('dwellByStatus', () => {
  it('averages per station, longest first', () => {
    const events = [
      // ticket a: Submitted 4 days
      ev({ ticketId: 'a', toStatus: 'Submitted', occurredAt: at('2026-07-01T00:00:00Z') }),
      ev({ ticketId: 'a', toStatus: 'Done', occurredAt: at('2026-07-05T00:00:00Z') }),
      // ticket b: Submitted 2 days
      ev({ ticketId: 'b', toStatus: 'Submitted', occurredAt: at('2026-07-01T00:00:00Z') }),
      ev({ ticketId: 'b', toStatus: 'Received', occurredAt: at('2026-07-03T00:00:00Z') }),
      ev({ ticketId: 'b', toStatus: 'Done', occurredAt: at('2026-07-04T00:00:00Z') }),
    ]
    expect(dwellByStatus(events)).toEqual([
      { status: 'Submitted', count: 2, avgDays: 3 },
      { status: 'Received', count: 1, avgDays: 1 },
    ])
  })
})

describe('dwellHeatmap', () => {
  it('splits each station by flow, zero-filling empty cells', () => {
    const events = [
      ev({ ticketId: 'a', flow: 'contract', toStatus: 'Submitted', occurredAt: at('2026-07-01T00:00:00Z') }),
      ev({ ticketId: 'a', flow: 'contract', toStatus: 'Done', occurredAt: at('2026-07-03T00:00:00Z') }),
    ]
    const rows = dwellHeatmap(events, ['general', 'contract', 'payment'])
    expect(rows).toEqual([
      {
        status: 'Submitted',
        avgDays: 2,
        count: 1,
        cells: [
          { flow: 'general', count: 0, avgDays: 0 },
          { flow: 'contract', count: 1, avgDays: 2 },
          { flow: 'payment', count: 0, avgDays: 0 },
        ],
      },
    ])
  })
})

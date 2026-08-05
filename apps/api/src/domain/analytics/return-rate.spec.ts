import { describe, it, expect } from 'vitest'
import { returnRateByFlow } from './return-rate'
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

describe('returnRateByFlow', () => {
  it('counts SendBack over distinct tickets per flow', () => {
    const events = [
      ev({ ticketId: 'a', flow: 'general', action: 'created' }),
      ev({ ticketId: 'a', flow: 'general', action: 'sendBack' }),
      ev({ ticketId: 'b', flow: 'general', action: 'created' }),
      ev({ ticketId: 'c', flow: 'contract', action: 'created' }),
    ]
    expect(returnRateByFlow(events, ['general', 'contract', 'payment'])).toEqual([
      { flow: 'general', tickets: 2, returns: 1, ratePct: 50 },
      { flow: 'contract', tickets: 1, returns: 0, ratePct: 0 },
      { flow: 'payment', tickets: 0, returns: 0, ratePct: 0 },
    ])
  })

  it('can exceed 100% when one ticket bounces repeatedly', () => {
    const events = [
      ev({ ticketId: 'a', flow: 'payment', action: 'created' }),
      ev({ ticketId: 'a', flow: 'payment', action: 'sendBack' }),
      ev({ ticketId: 'a', flow: 'payment', action: 'sendBack' }),
    ]
    expect(returnRateByFlow(events, ['payment'])).toEqual([
      { flow: 'payment', tickets: 1, returns: 2, ratePct: 200 },
    ])
  })
})

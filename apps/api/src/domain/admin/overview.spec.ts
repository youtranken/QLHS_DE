import { describe, it, expect } from 'vitest'
import { TICKET_STATUS } from '@qlhs/contracts'
import { makeThresholdOf, summarizeLines, type OverviewTicket } from './overview'

describe('makeThresholdOf (flow-specific wins, else * baseline, else null)', () => {
  const of = makeThresholdOf([
    { status: 'Submitted', flow: '*', slaDays: 3 },
    { status: 'Submitted', flow: 'Contract', slaDays: 5 },
  ])

  it('prefers a flow-specific threshold', () => {
    expect(of('Submitted', 'Contract')).toBe(5)
  })
  it('falls back to the * baseline', () => {
    expect(of('Submitted', 'General')).toBe(3)
  })
  it('is null when no row matches (closed status)', () => {
    expect(of('Completed', 'Contract')).toBeNull()
  })
})

describe('summarizeLines (AD-6 derive running/overdue/on-time)', () => {
  const NOW = new Date('2026-07-20T00:00:00.000Z') // a Monday
  const long = new Date('2026-07-01T00:00:00.000Z') // ~13 business days earlier
  const fresh = new Date('2026-07-20T00:00:00.000Z')
  const of = makeThresholdOf([{ status: 'Submitted', flow: '*', slaDays: 2 }])

  const tickets: OverviewTicket[] = [
    { flow: 'Contract', status: 'Submitted', statusEnteredAt: long }, // overdue
    { flow: 'Contract', status: 'Submitted', statusEnteredAt: fresh }, // on time
    { flow: 'Contract', status: TICKET_STATUS.Completed, statusEnteredAt: long }, // terminal → not running
    { flow: 'General', status: 'Submitted', statusEnteredAt: fresh }, // on time
  ]

  it('excludes terminal tickets from running', () => {
    const contract = summarizeLines(tickets, ['Contract'], of, NOW)[0]
    expect(contract.running).toBe(2)
  })

  it('counts overdue and derives on-time %', () => {
    const contract = summarizeLines(tickets, ['Contract'], of, NOW)[0]
    expect(contract.overdue).toBe(1)
    expect(contract.onTimePct).toBe(50)
  })

  it('reports 100% on-time for an empty line', () => {
    const [payment] = summarizeLines(tickets, ['Payment'], of, NOW)
    expect(payment).toEqual({ flow: 'Payment', running: 0, overdue: 0, onTimePct: 100 })
  })
})

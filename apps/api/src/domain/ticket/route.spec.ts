import { describe, it, expect } from 'vitest'
import { FLOW, TICKET_STATUS } from '@qlhs/contracts'
import { projectedRoute, flowStations, displayStation } from './route'

describe('projectedRoute (FR-18 — full route from submit)', () => {
  it('General at Submitted: now first, rest next', () => {
    expect(projectedRoute(FLOW.General, TICKET_STATUS.Submitted)).toEqual([
      { status: TICKET_STATUS.Submitted, phase: 'now' },
      { status: TICKET_STATUS.SubmittedToVpAndy, phase: 'next' },
      { status: TICKET_STATUS.Completed, phase: 'next' },
    ])
  })

  it('General at VP Andy: Submitted past, VP Andy now, Completed next', () => {
    expect(projectedRoute(FLOW.General, TICKET_STATUS.SubmittedToVpAndy).map((s) => s.phase)).toEqual(
      ['past', 'now', 'next'],
    )
  })

  it('General at Completed: all past/now', () => {
    expect(projectedRoute(FLOW.General, TICKET_STATUS.Completed).map((s) => s.phase)).toEqual([
      'past',
      'past',
      'now',
    ])
  })

  it('inserts the BOP station when the ticket is at BOP', () => {
    const route = projectedRoute(FLOW.General, TICKET_STATUS.SubmittedToBop)
    expect(route.map((s) => s.status)).toEqual([
      TICKET_STATUS.Submitted,
      TICKET_STATUS.SubmittedToVpAndy,
      TICKET_STATUS.SubmittedToBop,
      TICKET_STATUS.Completed,
    ])
    expect(route.find((s) => s.status === TICKET_STATUS.SubmittedToBop)?.phase).toBe('now')
  })

  it('Payment route ends with a single Completed finish — no separate Sent to Accounting station', () => {
    const route = projectedRoute(FLOW.Payment, TICKET_STATUS.Submitted)
    expect(route[route.length - 1]?.status).toBe(TICKET_STATUS.Completed)
    expect(route.some((s) => s.status === TICKET_STATUS.SentToAccounting)).toBe(false)
    expect(flowStations(FLOW.Payment).at(-1)).toBe(TICKET_STATUS.Completed)
    expect(flowStations(FLOW.Payment)).not.toContain(TICKET_STATUS.SentToAccounting)
  })

  it('Payment at Sent to Accounting lands on the Completed finish (H5)', () => {
    const route = projectedRoute(FLOW.Payment, TICKET_STATUS.SentToAccounting)
    expect(route.find((s) => s.status === TICKET_STATUS.Completed)?.phase).toBe('now')
    expect(route.slice(0, -1).every((s) => s.phase === 'past')).toBe(true)
  })

  it('displayStation folds Payment Sent to Accounting into Completed, leaves others as-is', () => {
    expect(displayStation(FLOW.Payment, TICKET_STATUS.SentToAccounting)).toBe(TICKET_STATUS.Completed)
    expect(displayStation(FLOW.Payment, TICKET_STATUS.ReceivedByDcc3)).toBe(TICKET_STATUS.ReceivedByDcc3)
    expect(displayStation(FLOW.Contract, TICKET_STATUS.SentToAccounting)).toBe(TICKET_STATUS.SentToAccounting)
  })
})

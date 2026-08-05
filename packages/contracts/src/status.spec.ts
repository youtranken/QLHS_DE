import { describe, it, expect } from 'vitest'
import {
  TICKET_STATUS,
  ALL_STATUSES,
  TERMINAL_STATUSES,
  isTerminal,
  FLOW,
  ALL_FLOWS,
  apiError,
} from './index.js'

describe('canonical status names (AD-13)', () => {
  it('keeps the exact canonical EN strings', () => {
    expect(TICKET_STATUS.SubmittedToVpAndy).toBe('Submitted to VP Andy')
    expect(TICKET_STATUS.ReturnFixing).toBe('Return-fixing')
    expect(TICKET_STATUS.SubmittedToDcc2Hardcopy).toBe('Submitted to DCC2 (Hardcopy)')
  })

  it('keeps Sent to Accounting (Payment) distinct from Submitted to Accounting (Contract)', () => {
    expect(TICKET_STATUS.SentToAccounting).toBe('Sent to Accounting')
    expect(TICKET_STATUS.SubmittedToAccounting).toBe('Submitted to Accounting')
    expect(TICKET_STATUS.SentToAccounting).not.toBe(TICKET_STATUS.SubmittedToAccounting)
  })

  it('has exactly 17 statuses with no duplicate values', () => {
    expect(ALL_STATUSES).toHaveLength(17)
    expect(new Set(ALL_STATUSES).size).toBe(17)
  })
})

describe('terminal (closed) statuses — no SLA badge (PRD §8.2)', () => {
  it('is exactly {Completed, Sent to Accounting, Cancelled}', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(
      ['Cancelled', 'Completed', 'Sent to Accounting'],
    )
  })

  it('isTerminal is true only for closed statuses', () => {
    expect(isTerminal(TICKET_STATUS.Completed)).toBe(true)
    expect(isTerminal(TICKET_STATUS.SentToAccounting)).toBe(true)
    expect(isTerminal(TICKET_STATUS.SubmittedToAccounting)).toBe(false)
    expect(isTerminal(TICKET_STATUS.Submitted)).toBe(false)
  })
})

describe('Flow enum (B1) — full names, never A/B/C', () => {
  it('is General/Contract/Payment', () => {
    expect(ALL_FLOWS).toEqual(['General', 'Contract', 'Payment'])
    expect(FLOW.Contract).toBe('Contract')
  })
})

describe('ApiError envelope (AD-17)', () => {
  it('omits details when not provided', () => {
    expect(apiError('ForbiddenTransition', 'nope')).toEqual({
      code: 'ForbiddenTransition',
      message: 'nope',
    })
  })
  it('includes details when provided', () => {
    expect(apiError('Bad', 'x', { field: 'reason' })).toEqual({
      code: 'Bad',
      message: 'x',
      details: { field: 'reason' },
    })
  })
})

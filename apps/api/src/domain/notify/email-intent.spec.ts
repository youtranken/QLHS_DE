import { describe, it, expect } from 'vitest'
import { TICKET_STATUS } from '@qlhs/contracts'
import { emailIntentKind } from './email-intent'

describe('emailIntentKind (AD-15/H5 — one notification matrix)', () => {
  it('Completed → email intent (General/Contract)', () => {
    expect(emailIntentKind(TICKET_STATUS.Completed)).toBe(TICKET_STATUS.Completed)
  })

  it('Returned → email intent', () => {
    expect(emailIntentKind(TICKET_STATUS.Returned)).toBe(TICKET_STATUS.Returned)
  })

  it('Sent to Accounting (Payment close) → NO email (H5)', () => {
    expect(emailIntentKind(TICKET_STATUS.SentToAccounting)).toBeNull()
  })

  it('mid-flow states → no email', () => {
    expect(emailIntentKind(TICKET_STATUS.SubmittedToAccounting)).toBeNull()
    expect(emailIntentKind(TICKET_STATUS.ReceivedByDcc3)).toBeNull()
    expect(emailIntentKind(TICKET_STATUS.SubmittedToVpAndy)).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { ROLE, TICKET_STATUS } from '@qlhs/contracts'
import { escalationIntent, stationRole, ESCALATION_KIND, type EscalationConfig } from './escalation'

const cfg: EscalationConfig = { warnDays: 1, criticalOverdueDays: 3 }
const t = (over: Partial<Parameters<typeof escalationIntent>[0]> = {}) => ({
  status: TICKET_STATUS.SubmittedToVpAndy,
  overdueDays: 0,
  daysLeft: 5,
  holderSub: 'dcc1-nam',
  ...over,
})

describe('stationRole', () => {
  it('maps the Pool to DCC1 even though nobody holds it', () => {
    expect(stationRole(TICKET_STATUS.Submitted)).toBe(ROLE.Dcc1)
  })
  it('uses the state owner for held DCC stations', () => {
    expect(stationRole(TICKET_STATUS.ReceivedByDcc2)).toBe(ROLE.Dcc2)
    expect(stationRole(TICKET_STATUS.SubmittedToDcc3)).toBe(ROLE.Dcc3)
  })
  it('returns null for Applicant-owned and terminal states', () => {
    expect(stationRole(TICKET_STATUS.Returned)).toBeNull()
    expect(stationRole(TICKET_STATUS.ReturnFixing)).toBeNull()
    expect(stationRole(TICKET_STATUS.Completed)).toBeNull()
  })
})

describe('escalationIntent — the ladder', () => {
  it('nudges the holder privately when a ticket is due soon', () => {
    const i = escalationIntent(t({ overdueDays: 0, daysLeft: 1 }), cfg)
    expect(i).toEqual({
      kind: ESCALATION_KIND.Warn,
      recipientSub: 'dcc1-nam',
      recipientRole: null,
      waitingStatus: TICKET_STATUS.SubmittedToVpAndy,
    })
  })

  it('sends the due-soon nudge to the role when nobody holds it yet', () => {
    const i = escalationIntent(
      t({ status: TICKET_STATUS.SubmittedToDcc2, holderSub: null, daysLeft: 0 }),
      cfg,
    )
    expect(i).toMatchObject({ kind: ESCALATION_KIND.Warn, recipientSub: null, recipientRole: ROLE.Dcc2 })
  })

  it('CCs the whole station role once a ticket is overdue', () => {
    const i = escalationIntent(t({ status: TICKET_STATUS.ReceivedByDcc2, overdueDays: 1 }), cfg)
    expect(i).toMatchObject({ kind: ESCALATION_KIND.Overdue, recipientSub: null, recipientRole: ROLE.Dcc2 })
  })

  it('escalates to Admin once it is badly overdue', () => {
    const i = escalationIntent(t({ overdueDays: 3 }), cfg)
    expect(i).toMatchObject({ kind: ESCALATION_KIND.Critical, recipientRole: ROLE.Admin })
  })

  it('is silent while a ticket is comfortably within SLA', () => {
    expect(escalationIntent(t({ overdueDays: 0, daysLeft: 4 }), cfg)).toBeNull()
  })

  it('never escalates an Applicant-owned ticket', () => {
    expect(escalationIntent(t({ status: TICKET_STATUS.Returned, overdueDays: 9 }), cfg)).toBeNull()
  })
})

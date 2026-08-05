import { describe, it, expect } from 'vitest'
import { FLOW, ROLE, TICKET_STATUS } from '@qlhs/contracts'
import { roleFlows } from './role-flows'
import { stationsForRole } from './station-columns'

describe('roleFlows (AD-16 — server-side flow scope)', () => {
  it('lets DCC1 and Admin coordinate all three flows', () => {
    const all = [FLOW.General, FLOW.Contract, FLOW.Payment]
    expect(roleFlows(ROLE.Dcc1)).toEqual(all)
    expect(roleFlows(ROLE.Admin)).toEqual(all)
  })

  it('scopes DCC2 to Contract and DCC3 to Payment only', () => {
    expect(roleFlows(ROLE.Dcc2)).toEqual([FLOW.Contract])
    expect(roleFlows(ROLE.Dcc3)).toEqual([FLOW.Payment])
  })

  it('never leaks another flow across the DCC2/DCC3 boundary', () => {
    expect(roleFlows(ROLE.Dcc2)).not.toContain(FLOW.Payment)
    expect(roleFlows(ROLE.Dcc2)).not.toContain(FLOW.General)
    expect(roleFlows(ROLE.Dcc3)).not.toContain(FLOW.Contract)
    expect(roleFlows(ROLE.Dcc3)).not.toContain(FLOW.General)
  })

  it('gives Applicant and a role-less session no map', () => {
    expect(roleFlows(ROLE.Applicant)).toEqual([])
    expect(roleFlows(null)).toEqual([])
  })
})

describe('stationsForRole (AD-16 — board columns per role)', () => {
  it('gives DCC1/Admin the coordinator line (Pool → Andy → Chờ ACC → ACC-back → BOP)', () => {
    const dcc1 = [
      TICKET_STATUS.Submitted,
      TICKET_STATUS.SubmittedToVpAndy,
      TICKET_STATUS.SubmittedToAccounting,
      TICKET_STATUS.ReceivedFromAcc,
      TICKET_STATUS.SubmittedToBop,
    ]
    expect(stationsForRole(ROLE.Dcc1)).toEqual(dcc1)
    expect(stationsForRole(ROLE.Admin)).toEqual(dcc1)
  })

  it('gives DCC2 only its Contract stations, DCC3 only its Payment stations', () => {
    expect(stationsForRole(ROLE.Dcc2)).toEqual([
      TICKET_STATUS.SubmittedToDcc2,
      TICKET_STATUS.ReceivedByDcc2,
      TICKET_STATUS.SubmittedToAccounting,
      TICKET_STATUS.SubmittedToDcc2Hardcopy,
      TICKET_STATUS.Hardcopy,
    ])
    expect(stationsForRole(ROLE.Dcc3)).toEqual([
      TICKET_STATUS.SubmittedToDcc3,
      TICKET_STATUS.ReceivedByDcc3,
    ])
  })

  it('does not expose the General Pool column to DCC2/DCC3', () => {
    expect(stationsForRole(ROLE.Dcc2)).not.toContain(TICKET_STATUS.Submitted)
    expect(stationsForRole(ROLE.Dcc3)).not.toContain(TICKET_STATUS.Submitted)
  })

  it('gives Applicant and a role-less session no board', () => {
    expect(stationsForRole(ROLE.Applicant)).toEqual([])
    expect(stationsForRole(null)).toEqual([])
  })
})

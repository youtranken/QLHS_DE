import { describe, expect, it } from 'vitest'
import { ROLE, TICKET_STATUS, FLOW } from '@qlhs/contracts'
import { awaitingStatusesFor } from './build-digest.usecase'

describe('awaitingStatusesFor — what each DCC is waiting to act on', () => {
  it('DCC1 watches the Pool: unassigned tickets nobody has taken in yet', () => {
    expect(awaitingStatusesFor(ROLE.Dcc1)).toContain(TICKET_STATUS.Submitted)
  })

  it('DCC2 watches its own handover inbox, not DCC3’s', () => {
    const statuses = awaitingStatusesFor(ROLE.Dcc2)
    expect(statuses).toContain(TICKET_STATUS.SubmittedToDcc2)
    expect(statuses).not.toContain(TICKET_STATUS.SubmittedToDcc3)
  })

  it('DCC3 watches its own handover inbox, not DCC2’s', () => {
    const statuses = awaitingStatusesFor(ROLE.Dcc3)
    expect(statuses).toContain(TICKET_STATUS.SubmittedToDcc3)
    expect(statuses).not.toContain(TICKET_STATUS.SubmittedToDcc2)
  })

  it('gives Applicant nothing — the digest is for the people who process files', () => {
    expect(awaitingStatusesFor(ROLE.Applicant)).toEqual([])
  })

  it('never treats a closed status as something awaiting action', () => {
    for (const role of [ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3]) {
      expect(awaitingStatusesFor(role)).not.toContain(TICKET_STATUS.Completed)
      expect(awaitingStatusesFor(role)).not.toContain(FLOW.Payment)
    }
  })
})

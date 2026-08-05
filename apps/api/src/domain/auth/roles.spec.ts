import { describe, it, expect } from 'vitest'
import { ROLE } from '@qlhs/contracts'
import { resolveActiveRole, canUseRole, effectiveRoles, canSeeAllTicketChanges } from './roles'

describe('canSeeAllTicketChanges (SSE scope mirrors detail-read, AD-16)', () => {
  it('lets staff (any DCC/Admin appointment) see every ticket change', () => {
    expect(canSeeAllTicketChanges([ROLE.Dcc1])).toBe(true)
    expect(canSeeAllTicketChanges([ROLE.Admin])).toBe(true)
    expect(canSeeAllTicketChanges([ROLE.Applicant, ROLE.Dcc3])).toBe(true)
  })

  it('restricts a plain Applicant to their own tickets (filtered by the controller)', () => {
    expect(canSeeAllTicketChanges([ROLE.Applicant])).toBe(false)
    expect(canSeeAllTicketChanges([])).toBe(false)
  })
})

describe('effectiveRoles (AD-7 — every PMH ID login is at least an Applicant)', () => {
  it('gives an unappointed user the Applicant baseline', () => {
    expect(effectiveRoles([])).toEqual([ROLE.Applicant])
  })

  it('leaves an appointed user untouched (DCC/Admin do not get Applicant added)', () => {
    expect(effectiveRoles([ROLE.Dcc1])).toEqual([ROLE.Dcc1])
    expect(effectiveRoles([ROLE.Admin, ROLE.Dcc2])).toEqual([ROLE.Admin, ROLE.Dcc2])
  })
})

describe('resolveActiveRole (H3 — multi-role + active role)', () => {
  it('defaults to the first role in canonical order', () => {
    expect(resolveActiveRole([ROLE.Dcc2, ROLE.Applicant])).toBe(ROLE.Applicant)
  })

  it('keeps a remembered role the user still holds', () => {
    expect(resolveActiveRole([ROLE.Applicant, ROLE.Dcc2], ROLE.Dcc2)).toBe(ROLE.Dcc2)
  })

  it('drops a remembered role the user no longer holds', () => {
    expect(resolveActiveRole([ROLE.Applicant], ROLE.Dcc3)).toBe(ROLE.Applicant)
  })

  it('skips Admin when the user also holds an actionable role (SA owns no edges)', () => {
    expect(resolveActiveRole([ROLE.Admin, ROLE.Dcc2])).toBe(ROLE.Dcc2)
  })

  it('defaults to Admin only when it is the sole role', () => {
    expect(resolveActiveRole([ROLE.Admin])).toBe(ROLE.Admin)
  })

  it('is null when the user has no role', () => {
    expect(resolveActiveRole([])).toBeNull()
  })
})

describe('canUseRole', () => {
  it('guards by membership', () => {
    expect(canUseRole([ROLE.Dcc1], ROLE.Dcc1)).toBe(true)
    expect(canUseRole([ROLE.Dcc1], ROLE.Dcc2)).toBe(false)
  })
})

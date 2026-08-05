import { describe, it, expect } from 'vitest'
import { ROLE } from '@qlhs/contracts'
import { assertNotSelfLockout, SelfLockoutError } from './self-lockout'

describe('assertNotSelfLockout (an Admin cannot strip their own Admin role)', () => {
  it('throws when the actor removes Admin from themselves', () => {
    expect(() => assertNotSelfLockout('sa-1', 'sa-1', [ROLE.Dcc1])).toThrow(SelfLockoutError)
    expect(() => assertNotSelfLockout('sa-1', 'sa-1', [])).toThrow(SelfLockoutError)
  })

  it('allows the actor to keep Admin while changing their other roles', () => {
    expect(() => assertNotSelfLockout('sa-1', 'sa-1', [ROLE.Admin, ROLE.Dcc1])).not.toThrow()
  })

  it('allows demoting a DIFFERENT user (only self-lockout is blocked)', () => {
    expect(() => assertNotSelfLockout('sa-1', 'sa-2', [ROLE.Dcc1])).not.toThrow()
  })
})

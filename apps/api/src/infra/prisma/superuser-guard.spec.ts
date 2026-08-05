import { describe, it, expect } from 'vitest'
import { assertAppRoleNotSuperuser } from './superuser-guard'

describe('assertAppRoleNotSuperuser — AD-4 append-only depends on a non-superuser role', () => {
  it('throws in production when the app connects as a superuser', () => {
    // The append-only trigger keys on current_setting(is_superuser); a superuser
    // bypasses it, so ticket_event could be mutated. Must refuse to boot.
    expect(() => assertAppRoleNotSuperuser('on', true)).toThrow(/superuser/i)
  })

  it('permits a restricted (non-superuser) role in production', () => {
    expect(() => assertAppRoleNotSuperuser('off', true)).not.toThrow()
  })

  it('does not block a superuser outside production (local dev convenience)', () => {
    expect(() => assertAppRoleNotSuperuser('on', false)).not.toThrow()
  })
})

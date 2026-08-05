import { describe, it, expect } from 'vitest'
import { cameFromPortal, shouldAutostartSso } from './sso-autostart'

describe('cameFromPortal — only auto-SSO when launched from the PMH ID portal', () => {
  it('true on the portal launch flag ?sso=1', () => {
    expect(cameFromPortal('?sso=1', '')).toBe(true)
  })

  it('true when the referrer is the PMH ID host', () => {
    expect(cameFromPortal('', 'https://id.pmh.com.vn/launcher')).toBe(true)
  })

  it('false on a plain direct visit (no flag, no/foreign referrer)', () => {
    expect(cameFromPortal('', '')).toBe(false)
    expect(cameFromPortal('?foo=1', 'https://google.com')).toBe(false)
  })
})

describe('shouldAutostartSso — guards around the portal hand-off', () => {
  const portal = { anonymous: true, authError: false, search: '?sso=1', referrer: '' }

  it('hands off when anonymous + from portal + no error', () => {
    expect(shouldAutostartSso(portal)).toBe(true)
  })

  it('never redirects a direct visit — the email form must show', () => {
    expect(shouldAutostartSso({ ...portal, search: '', referrer: '' })).toBe(false)
  })

  it('does not redirect once authenticated', () => {
    expect(shouldAutostartSso({ ...portal, anonymous: false })).toBe(false)
  })

  it('does not loop after a denied callback (?auth_error=)', () => {
    expect(shouldAutostartSso({ ...portal, authError: true })).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { sanitizeLoginHint } from './pmh-id.identity'

describe('sanitizeLoginHint — untrusted query value forwarded to PMH ID', () => {
  it('keeps a plausible email (trimmed)', () => {
    expect(sanitizeLoginHint('  nguyen@pmh.com.vn ')).toBe('nguyen@pmh.com.vn')
  })

  it('drops non-emails so nothing junk reaches the IdP', () => {
    expect(sanitizeLoginHint('not-an-email')).toBeUndefined()
    expect(sanitizeLoginHint('a b@x.vn')).toBeUndefined()
  })

  it('drops empty / missing / over-long values', () => {
    expect(sanitizeLoginHint('')).toBeUndefined()
    expect(sanitizeLoginHint(undefined)).toBeUndefined()
    expect(sanitizeLoginHint(`${'a'.repeat(200)}@x.vn`)).toBeUndefined()
  })
})

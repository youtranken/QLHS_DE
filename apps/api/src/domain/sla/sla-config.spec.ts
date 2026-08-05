import { describe, it, expect } from 'vitest'
import { isValidSlaDays } from './sla-config'

describe('isValidSlaDays (Story 5.1 — admin threshold guard)', () => {
  it('accepts a positive integer number of days', () => {
    expect(isValidSlaDays(1)).toBe(true)
    expect(isValidSlaDays(7)).toBe(true)
  })

  it('rejects zero, negatives and non-integers', () => {
    expect(isValidSlaDays(0)).toBe(false)
    expect(isValidSlaDays(-3)).toBe(false)
    expect(isValidSlaDays(2.5)).toBe(false)
    expect(isValidSlaDays(Number.NaN)).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { isDateOnly } from './is-date-only'

// Guards the date-500 class: a loose `new Date(input)` on an unconstrained query
// param yields `Invalid Date`, which then reaches Prisma and 500s. Only a real
// `YYYY-MM-DD` calendar day may pass — datetimes and rollovers are rejected here.
describe('isDateOnly', () => {
  it('accepts a plain calendar day', () => {
    expect(isDateOnly('2026-07-25')).toBe(true)
    expect(isDateOnly('2000-02-29')).toBe(true) // real leap day
  })

  it('rejects an ISO datetime (the closed-tickets bug: concatenation → Invalid Date)', () => {
    expect(isDateOnly('2026-07-25T10:00:00Z')).toBe(false)
    expect(isDateOnly('2026-07-25T00:00:00.000Z')).toBe(false)
  })

  it('rejects impossible calendar days that match the shape', () => {
    expect(isDateOnly('2026-02-30')).toBe(false)
    expect(isDateOnly('2026-13-01')).toBe(false)
    expect(isDateOnly('2025-02-29')).toBe(false) // not a leap year
  })

  it('rejects garbage, wrong separators, and non-strings', () => {
    expect(isDateOnly('not-a-date')).toBe(false)
    expect(isDateOnly('2026/07/25')).toBe(false)
    expect(isDateOnly('26-7-5')).toBe(false)
    expect(isDateOnly('')).toBe(false)
    expect(isDateOnly(undefined)).toBe(false)
    expect(isDateOnly(20260725)).toBe(false)
  })
})

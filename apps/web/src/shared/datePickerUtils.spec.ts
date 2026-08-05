import { describe, it, expect } from 'vitest'
import { parseISO, toISO, sameDay, decadeStart, buildDays, buildYears } from './datePickerUtils'

describe('datePickerUtils', () => {
  it('parses valid ISO and rejects junk', () => {
    expect(toISO(parseISO('2026-07-30')!)).toBe('2026-07-30')
    expect(parseISO('')).toBeNull()
    expect(parseISO('30/07/2026')).toBeNull()
  })

  it('toISO zero-pads month/day', () => {
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('sameDay ignores time', () => {
    expect(sameDay(new Date(2026, 6, 30, 9), new Date(2026, 6, 30, 23))).toBe(true)
    expect(sameDay(new Date(2026, 6, 30), new Date(2026, 6, 31))).toBe(false)
  })

  it('decadeStart floors to the decade', () => {
    expect(decadeStart(new Date(2026, 0, 1))).toBe(2020)
  })

  it('buildDays yields 42 Monday-first cells covering the month', () => {
    const cells = buildDays(new Date(2026, 6, 1)) // July 2026
    expect(cells).toHaveLength(42)
    // The 1st of the month must be present and not dimmed.
    expect(cells.some((c) => !c.dim && c.date.getDate() === 1 && c.date.getMonth() === 6)).toBe(true)
  })

  it('buildYears returns a 12-year window around the decade', () => {
    const ys = buildYears(new Date(2026, 0, 1))
    expect(ys).toHaveLength(12)
    expect(ys[0]).toBe(2019) // decadeStart(2020) - 1
  })
})

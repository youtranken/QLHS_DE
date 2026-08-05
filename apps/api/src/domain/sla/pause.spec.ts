import { describe, expect, it } from 'vitest'
import { pausedBusinessDays, effectiveEnteredAt, type PauseWindow } from './pause'
import { dwellDays, overdueDays } from './overdue'
import { addBusinessDays } from './business-days'

// Mon 2026-07-20 … Fri 2026-07-24, Sat 25, Sun 26, Mon 27.
const mon = (d: number, h = 9) => new Date(Date.UTC(2026, 6, d, h, 0, 0))
const w = (from: Date, to: Date | null): PauseWindow => ({ from, to })

describe('pausedBusinessDays — how much of a pause the SLA should forgive', () => {
  it('counts nothing when the ticket was never paused', () => {
    expect(pausedBusinessDays([], mon(24))).toBe(0)
  })

  it('counts the business days of a closed pause window', () => {
    expect(pausedBusinessDays([w(mon(20), mon(23))], mon(24))).toBe(3)
  })

  it('counts an OPEN pause up to now — the clock is still stopped', () => {
    expect(pausedBusinessDays([w(mon(20), null)], mon(23))).toBe(3)
  })

  it('skips the weekend inside a pause — SLA is in business days, so a pause must be too', () => {
    // Fri 24 → Mon 27 spans 3 calendar days but only 1 business day.
    expect(pausedBusinessDays([w(mon(24), mon(27))], mon(27))).toBe(1)
  })

  it('adds up several pauses in the same station', () => {
    expect(pausedBusinessDays([w(mon(20), mon(21)), w(mon(22), mon(24))], mon(24))).toBe(3)
  })

  it('ignores a zero-length pause (paused and resumed in the same minute)', () => {
    expect(pausedBusinessDays([w(mon(20), mon(20))], mon(24))).toBe(0)
  })

  it('never counts a pause that starts in the future — a clock skew must not gift SLA days', () => {
    expect(pausedBusinessDays([w(mon(27), null)], mon(24))).toBe(0)
  })

  it('merges overlapping windows instead of double-counting the shared days', () => {
    // [Mon20,Wed22] ∪ [Tue21,Thu23] is really Mon→Thu = 3 business days, not 4.
    // Bad/repaired data can produce overlaps; the maths must not over-forgive.
    expect(pausedBusinessDays([w(mon(20), mon(22)), w(mon(21), mon(23))], mon(24))).toBe(3)
  })
})

describe('effectiveEnteredAt — pause shifts the SLA start, it does not change status', () => {
  it('returns the raw entry time when nothing was paused', () => {
    expect(effectiveEnteredAt(mon(20), [], mon(24))).toEqual(mon(20))
  })

  it('skips the weekend on the VIETNAM calendar, not the UTC one', () => {
    // 18:00 UTC on Fri 24 is already Sat 25 in Vietnam, so one business day
    // forward is Mon 27 ICT. Stepping by UTC weekdays would stop at Mon 27 UTC
    // = Tue 28 ICT and forgive an extra day.
    const fridayEveningUtc = new Date(Date.UTC(2026, 6, 24, 18, 0, 0)) // Sat 25 01:00 ICT
    const shifted = effectiveEnteredAt(fridayEveningUtc, [w(fridayEveningUtc, null)], mon(27))
    // Mon 27 01:00 ICT = Sun 26 18:00 UTC.
    expect(shifted.toISOString()).toBe('2026-07-26T18:00:00.000Z')
  })

  it('pushes the start forward by the paused business days', () => {
    const shifted = effectiveEnteredAt(mon(20), [w(mon(20), mon(22)), w(mon(23), null)], mon(24))
    expect(shifted.getTime()).toBeGreaterThan(mon(20).getTime())
  })

  it('clamps a window that opened before this station — only paused time in THIS station is forgiven', () => {
    // A pause opened at a prior station (Mon20) that reaches this row must not
    // shift a clock that only started on Wed22, or a genuinely late ticket hides.
    const shifted = effectiveEnteredAt(mon(22), [w(mon(20), mon(24))], mon(24))
    // Clamped window is [Wed22,Fri24] = 2 business days, not [Mon20,Fri24] = 4.
    expect(shifted).toEqual(addBusinessDays(mon(22), 2))
  })
})

describe('SLA maths with a pause — the reason F8 exists', () => {
  const THRESHOLD = 3

  it('a ticket held 5 business days but paused 3 of them is NOT overdue', () => {
    const pauses = [w(mon(21), mon(24))]
    const start = effectiveEnteredAt(mon(20), pauses, mon(27))
    expect(overdueDays(start, THRESHOLD, mon(27))).toBe(0)
  })

  it('the same ticket WITHOUT the pause is overdue — proof the pause is what saved it', () => {
    expect(overdueDays(mon(20), THRESHOLD, mon(27))).toBeGreaterThan(0)
  })

  it('a pause cannot hide a station that is genuinely slow', () => {
    const pauses = [w(mon(21), mon(22))]
    const start = effectiveEnteredAt(mon(20), pauses, mon(27))
    expect(overdueDays(start, THRESHOLD, mon(27))).toBeGreaterThan(0)
  })

  it('dwell shown to the user also excludes paused time — the card must agree with the badge', () => {
    const pauses = [w(mon(21), mon(24))]
    const start = effectiveEnteredAt(mon(20), pauses, mon(27))
    expect(dwellDays(start, mon(27))).toBe(dwellDays(mon(20), mon(27)) - 3)
  })
})

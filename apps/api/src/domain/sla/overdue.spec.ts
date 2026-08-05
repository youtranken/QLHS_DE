import { describe, it, expect } from 'vitest'
import { businessDaysBetween, isBusinessDay } from './business-days'
import { overdueDays, isOverdue } from './overdue'

describe('businessDaysBetween (weekends excluded, H1)', () => {
  it('counts weekdays only', () => {
    // Mon 2026-07-06 → Thu 2026-07-09 = Tue,Wed,Thu = 3
    expect(businessDaysBetween(new Date('2026-07-06'), new Date('2026-07-09'))).toBe(3)
  })

  it('skips the weekend', () => {
    // Fri 2026-07-10 → Mon 2026-07-13 = 1 (Sat/Sun skipped)
    expect(businessDaysBetween(new Date('2026-07-10'), new Date('2026-07-13'))).toBe(1)
  })

  it('is 0 when to <= from', () => {
    expect(businessDaysBetween(new Date('2026-07-10'), new Date('2026-07-10'))).toBe(0)
  })

  it('classifies calendar days in Asia/Ho_Chi_Minh, not the server timezone', () => {
    // Sat 2026-07-11 06:00 VN is still Fri 23:00Z; Wed 2026-07-15 06:00 VN is Tue 23:00Z.
    // The VN calendar spans Sat→Wed → Sun(skip),Mon,Tue,Wed = 3 business days.
    // A UTC-floored (buggy) count would see Fri→Tue = 2, silently shifting the SLA badge.
    const enteredSatVN = new Date('2026-07-10T23:00:00Z')
    const wedVN = new Date('2026-07-14T23:00:00Z')
    expect(businessDaysBetween(enteredSatVN, wedVN)).toBe(3)
  })
})

describe('overdue (AD-6, derived at read)', () => {
  const entered = new Date('2026-07-06T00:00:00Z') // Monday
  const thu = new Date('2026-07-09T09:00:00Z') // +3 business days

  it('is overdue past the threshold', () => {
    expect(overdueDays(entered, 1, thu)).toBe(2)
    expect(isOverdue(entered, 1, thu)).toBe(true)
  })

  it('is within SLA at/under the threshold', () => {
    expect(overdueDays(entered, 3, thu)).toBe(0)
    expect(isOverdue(entered, 5, thu)).toBe(false)
  })

  it('a null threshold (closed status) is never overdue', () => {
    expect(isOverdue(entered, null, thu)).toBe(false)
  })
})

describe('isBusinessDay (F11 — the digest only fires on working days)', () => {
  it('is true Monday to Friday', () => {
    // Mon 2026-07-20 … Fri 2026-07-24, midday VN so the zone conversion is unambiguous.
    for (const day of [20, 21, 22, 23, 24]) {
      expect(isBusinessDay(new Date(Date.UTC(2026, 6, day, 5, 0, 0)))).toBe(true)
    }
  })

  it('is false at the weekend', () => {
    expect(isBusinessDay(new Date(Date.UTC(2026, 6, 25, 5, 0, 0)))).toBe(false)
    expect(isBusinessDay(new Date(Date.UTC(2026, 6, 26, 5, 0, 0)))).toBe(false)
  })

  it('uses the Vietnam calendar, not the process TZ: Sunday 17:00 UTC is already Monday in VN', () => {
    expect(isBusinessDay(new Date(Date.UTC(2026, 6, 26, 17, 30, 0)))).toBe(true)
  })
})

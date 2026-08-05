import { describe, it, expect } from 'vitest'
import { civilYmd, periodKey } from './period'

describe('civilYmd (Vietnam civil calendar, TZ-free)', () => {
  it('rolls to the next day for a late-UTC instant already tomorrow in ICT', () => {
    // 2026-07-26 23:30 UTC = 2026-07-27 06:30 ICT.
    expect(civilYmd(new Date('2026-07-26T23:30:00Z'))).toBe('2026-07-27')
  })
})

describe('periodKey month', () => {
  it('keys by YYYY-MM on the civil calendar', () => {
    expect(periodKey(new Date('2026-07-15T03:00:00Z'), 'month')).toBe('2026-07')
    // 2026-07-31 20:00 UTC = 2026-08-01 03:00 ICT → August.
    expect(periodKey(new Date('2026-07-31T20:00:00Z'), 'month')).toBe('2026-08')
  })
})

describe('periodKey week (ISO Monday)', () => {
  it('snaps every weekday to that week Monday', () => {
    // 2026-07-27 is a Monday; the week runs Mon 27th → Sun Aug 2nd.
    const monday = '2026-07-27'
    for (const day of ['2026-07-27', '2026-07-29', '2026-08-02']) {
      expect(periodKey(new Date(`${day}T05:00:00Z`), 'week')).toBe(monday)
    }
  })

  it('puts Sunday in the week that just ended, not the one starting', () => {
    // Sunday 2026-07-26 belongs to the Mon 2026-07-20 week.
    expect(periodKey(new Date('2026-07-26T05:00:00Z'), 'week')).toBe('2026-07-20')
  })
})

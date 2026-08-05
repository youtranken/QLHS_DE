import { describe, it, expect } from 'vitest'
import { topOverdue, type OverdueInput } from './overdue-rank'

const now = new Date('2026-07-27T00:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

const row = (over: Partial<OverdueInput>): OverdueInput => ({
  id: 'i',
  code: 'C',
  flow: 'general',
  status: 'Submitted',
  enteredAt: daysAgo(1),
  holderSub: null,
  ...over,
})

// Every station's threshold is 2 days for this test.
const threshold = () => 2

describe('topOverdue', () => {
  it('keeps only overdue running tickets, worst first, capped at limit', () => {
    // overdueDays counts BUSINESS days (weekends excluded), then minus the 2-day
    // threshold. now is Monday 2026-07-27: 10 days back = Fri 07-17 → 6 business
    // days elapsed → 4 over; 5 days back = Wed 07-22 → 3 elapsed → 1 over.
    const rows = [
      row({ id: 'a', code: 'A', enteredAt: daysAgo(10) }),
      row({ id: 'b', code: 'B', enteredAt: daysAgo(5) }),
      row({ id: 'c', code: 'C', enteredAt: daysAgo(1) }), // within SLA
    ]
    const out = topOverdue(rows, threshold, now, 5)
    expect(out.map((r) => r.id)).toEqual(['a', 'b'])
    expect(out[0]!.overdueDays).toBe(4)
  })

  it('never ranks a terminal ticket even if its clock looks old', () => {
    const rows = [row({ id: 'done', status: 'Completed', enteredAt: daysAgo(30) })]
    expect(topOverdue(rows, threshold, now, 5)).toEqual([])
  })

  it('honours the limit', () => {
    const rows = [
      row({ id: 'a', code: 'A', enteredAt: daysAgo(10) }),
      row({ id: 'b', code: 'B', enteredAt: daysAgo(9) }),
      row({ id: 'c', code: 'D', enteredAt: daysAgo(8) }),
    ]
    expect(topOverdue(rows, threshold, now, 2).map((r) => r.id)).toEqual(['a', 'b'])
  })
})

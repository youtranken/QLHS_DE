import { describe, expect, it } from 'vitest'
import { buildDigest, type DigestCandidate } from './digest'

// Mon 2026-07-20 … Fri 24, Sat 25, Sun 26, Mon 27. "now" is Monday morning.
const NOW = new Date(Date.UTC(2026, 6, 27, 1, 0, 0))
const dayBefore = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

function held(over: Partial<DigestCandidate> = {}): DigestCandidate {
  return {
    code: 'PMH-C-2026-0791',
    flow: 'Payment',
    status: 'In Process by DCC1',
    enteredAt: dayBefore(1),
    threshold: 3,
    paused: false,
    ...over,
  }
}

describe('buildDigest — silence unless there is something worth interrupting for', () => {
  it('sends nothing when the person holds nothing', () => {
    expect(buildDigest({ held: [], awaiting: [] }, NOW)).toBeNull()
  })

  it('sends nothing when everything held is comfortably inside SLA', () => {
    expect(buildDigest({ held: [held({ enteredAt: dayBefore(1), threshold: 5 })], awaiting: [] }, NOW)).toBeNull()
  })

  it('sends when a held ticket is already overdue', () => {
    const digest = buildDigest({ held: [held({ enteredAt: dayBefore(14), threshold: 3 })], awaiting: [] }, NOW)
    expect(digest?.overdue).toHaveLength(1)
    expect(digest?.overdue[0]?.overdueDays).toBeGreaterThan(0)
  })

  it('sends when a held ticket is due today or tomorrow — the useful warning', () => {
    // Entered Thu 23 with a 3-day threshold: Fri 24 + Mon 27 elapsed → 1 day left.
    const digest = buildDigest({ held: [held({ enteredAt: dayBefore(4), threshold: 3 })], awaiting: [] }, NOW)
    expect(digest?.dueSoon).toHaveLength(1)
    expect(digest?.overdue).toHaveLength(0)
  })

  it('sends when something in the shared inbox is running out of time', () => {
    const waiting = held({ status: 'Submitted to DCC2', enteredAt: dayBefore(14), threshold: 3 })
    const digest = buildDigest({ held: [], awaiting: [waiting] }, NOW)
    expect(digest?.awaiting).toHaveLength(1)
  })

  it('stays silent about a Pool ticket that still has time on the clock', () => {
    // The Pool is never empty, and its seeded SLA is a single day — warning a day
    // ahead would mail DCC1 every working morning and train them to ignore it.
    const fresh = held({ status: 'Submitted', enteredAt: NOW, threshold: 1 })
    expect(buildDigest({ held: [], awaiting: [fresh] }, NOW)).toBeNull()
  })

  it('speaks up about a Pool ticket the day its allowance runs out', () => {
    const spent = held({ status: 'Submitted', enteredAt: dayBefore(3), threshold: 1 })
    expect(buildDigest({ held: [], awaiting: [spent] }, NOW)?.awaiting).toHaveLength(1)
  })
})

describe('buildDigest — a paused ticket must never be nagged about (F8)', () => {
  it('leaves a paused overdue ticket out entirely', () => {
    const paused = held({ enteredAt: dayBefore(14), threshold: 3, paused: true })
    expect(buildDigest({ held: [paused], awaiting: [] }, NOW)).toBeNull()
  })

  it('still reports the unpaused ones alongside it', () => {
    const digest = buildDigest(
      {
        held: [held({ enteredAt: dayBefore(14), threshold: 3, paused: true }), held({ code: 'B', enteredAt: dayBefore(14), threshold: 3 })],
        awaiting: [],
      },
      NOW,
    )
    expect(digest?.overdue.map((t) => t.code)).toEqual(['B'])
  })
})

describe('buildDigest — shape and ordering', () => {
  it('never lists a ticket twice: overdue wins over due-soon', () => {
    const digest = buildDigest({ held: [held({ enteredAt: dayBefore(14), threshold: 3 })], awaiting: [] }, NOW)
    expect(digest?.dueSoon).toHaveLength(0)
    expect(digest?.overdue).toHaveLength(1)
  })

  it('puts the worst-overdue first — that is the one to open', () => {
    const digest = buildDigest(
      {
        held: [
          held({ code: 'MILD', enteredAt: dayBefore(7), threshold: 3 }),
          held({ code: 'WORST', enteredAt: dayBefore(30), threshold: 3 }),
        ],
        awaiting: [],
      },
      NOW,
    )
    expect(digest?.overdue.map((t) => t.code)).toEqual(['WORST', 'MILD'])
  })

  it('ignores a ticket with no SLA at all (terminal/no threshold)', () => {
    expect(buildDigest({ held: [held({ threshold: null, enteredAt: dayBefore(30) })], awaiting: [] }, NOW)).toBeNull()
  })

  it('counts everything it will mention, for the subject line', () => {
    const digest = buildDigest(
      {
        held: [held({ code: 'A', enteredAt: dayBefore(14), threshold: 3 }), held({ code: 'B', enteredAt: dayBefore(4), threshold: 3 })],
        awaiting: [held({ code: 'C', status: 'Submitted to DCC2', enteredAt: dayBefore(14), threshold: 3 })],
      },
      NOW,
    )
    expect(digest?.total).toBe(3)
  })
})

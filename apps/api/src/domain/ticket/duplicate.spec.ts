import { describe, expect, it } from 'vitest'
import { TICKET_STATUS, FLOW } from '@qlhs/contracts'
import { DUP_TIER, findDuplicates, type DupSubject } from './duplicate'

const NOW = new Date('2026-07-26T09:00:00Z')
const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

function t(over: Partial<DupSubject> = {}): DupSubject {
  return {
    id: 'other-1',
    code: 'PMH-B-2026-0001',
    status: TICKET_STATUS.Submitted,
    flow: FLOW.Contract,
    documentType: 'Contract Payment',
    contractNo: 'HĐ-2026/ABC',
    projectTeam: 'Team Alpha',
    contractor: 'Công ty ABC',
    amount: 500_000_000n,
    currency: 'VND',
    createdAt: days(2),
    ...over,
  }
}

// The single rule: within a month, same Document Type + Contract No + Project/Team.
describe('findDuplicates — same docType + contractNo + projectTeam within a month', () => {
  it('flags a ticket that matches all three within the window', () => {
    const hits = findDuplicates(t({ id: 'me', code: null }), [t()], NOW)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ id: 'other-1', tier: DUP_TIER.Strong })
  })

  it('never flags the subject against itself', () => {
    expect(findDuplicates(t({ id: 'me' }), [t({ id: 'me' })], NOW)).toEqual([])
  })

  it('ignores punctuation/case/space in the contract no', () => {
    const hits = findDuplicates(t({ id: 'me', contractNo: ' hd-2026 / abc ' }), [t()], NOW)
    expect(hits[0]?.tier).toBe(DUP_TIER.Strong)
  })

  it('ignores case/whitespace/diacritics in document type and project/team', () => {
    const hits = findDuplicates(
      t({ id: 'me', documentType: 'contract  payment', projectTeam: 'team   alpha' }),
      [t()],
      NOW,
    )
    expect(hits[0]?.tier).toBe(DUP_TIER.Strong)
  })

  it('matches across flows — the same paper pushed through two flows is the double-submit', () => {
    const hits = findDuplicates(t({ id: 'me', flow: FLOW.Payment }), [t()], NOW)
    expect(hits[0]?.tier).toBe(DUP_TIER.Strong)
  })

  it('does NOT flag a different document type', () => {
    expect(findDuplicates(t({ id: 'me', documentType: 'Other Doc' }), [t()], NOW)).toEqual([])
  })

  it('does NOT flag a different contract no', () => {
    expect(findDuplicates(t({ id: 'me', contractNo: 'KHAC-999' }), [t()], NOW)).toEqual([])
  })

  it('does NOT flag a different project/team', () => {
    expect(findDuplicates(t({ id: 'me', projectTeam: 'Team Beta' }), [t()], NOW)).toEqual([])
  })

  it('does NOT flag when any of the three is missing on either side', () => {
    expect(findDuplicates(t({ id: 'me', documentType: null }), [t()], NOW)).toEqual([])
    expect(findDuplicates(t({ id: 'me', contractNo: '  ' }), [t()], NOW)).toEqual([])
    expect(findDuplicates(t({ id: 'me' }), [t({ projectTeam: null })], NOW)).toEqual([])
  })

  it('never flags a Cancelled ticket — it was withdrawn, resubmitting is legitimate', () => {
    expect(findDuplicates(t({ id: 'me' }), [t({ status: TICKET_STATUS.Cancelled })], NOW)).toEqual([])
  })

  it('still flags a recently-completed match (a re-submit of just-closed work)', () => {
    const hits = findDuplicates(t({ id: 'me' }), [t({ status: TICKET_STATUS.Completed })], NOW)
    expect(hits[0]?.tier).toBe(DUP_TIER.Strong)
  })
})

describe('findDuplicates — the one-month window', () => {
  it('does NOT flag two submissions more than 30 days apart', () => {
    expect(findDuplicates(t({ id: 'me' }), [t({ createdAt: days(35) })], NOW)).toEqual([])
  })

  it('treats the 30-day window symmetrically — order of the two dates must not change the verdict', () => {
    const DAY = 86_400_000
    const gap = 30 * DAY + 5 * 3_600_000
    const earlier = new Date('2026-06-20T00:00:00Z')
    const later = new Date(earlier.getTime() + gap)
    const subjectEarlier = findDuplicates(t({ id: 'me', createdAt: earlier }), [t({ createdAt: later })], NOW)
    const subjectLater = findDuplicates(t({ id: 'me', createdAt: later }), [t({ createdAt: earlier })], NOW)
    expect(subjectEarlier[0]?.tier).toBe(DUP_TIER.Strong)
    expect(subjectLater[0]?.tier).toBe(DUP_TIER.Strong)
  })

  it('measures the window between the two tickets, not from today', () => {
    // A ticket that has sat in the Pool for months must not be flagged against
    // something filed last week just because both are "recent enough" to now.
    const stale = t({ id: 'me', createdAt: days(95) })
    expect(findDuplicates(stale, [t({ createdAt: days(5) })], NOW)).toEqual([])
  })

  it('flags two submissions filed close together even when both are old', () => {
    const stale = t({ id: 'me', createdAt: days(95) })
    const hits = findDuplicates(stale, [t({ createdAt: days(97) })], NOW)
    expect(hits[0]?.tier).toBe(DUP_TIER.Strong)
  })
})

describe('findDuplicates — ranking and shape', () => {
  it('orders newest match first and carries what DCC1 needs on hover', () => {
    const recent = t({ id: 'recent', code: 'PMH-B-0002', createdAt: days(1) })
    const older = t({ id: 'older', code: 'PMH-B-0003', createdAt: days(20) })
    const hits = findDuplicates(t({ id: 'me' }), [older, recent], NOW)
    expect(hits.map((h) => h.id)).toEqual(['recent', 'older'])
    expect(hits[0]).toMatchObject({
      code: 'PMH-B-0002',
      status: TICKET_STATUS.Submitted,
      contractor: 'Công ty ABC',
      amount: '500000000',
      ageDays: 1,
    })
  })

  it('caps the list so a pathological match set cannot flood the card', () => {
    const many = Array.from({ length: 12 }, (_, i) => t({ id: `x${i}`, code: `C${i}` }))
    expect(findDuplicates(t({ id: 'me' }), many, NOW)).toHaveLength(5)
  })
})

import { describe, it, expect } from 'vitest'
import { cardMatches, EMPTY_FILTER, type BoardFilter } from './boardFilter'
import type { BoardCard } from './api'

const card = (over: Partial<BoardCard> = {}): BoardCard =>
  ({
    id: 'x',
    code: 'B-2026-0001',
    contractor: 'Cty ABC',
    amount: null,
    priority: 'normal',
    flow: 'Contract',
    status: 'Submitted to DCC2',
    overdueDays: 0,
    lockedByMe: false,
    lockedBy: null,
    actions: [],
    ...over,
  }) as BoardCard

const f = (over: Partial<BoardFilter> = {}): BoardFilter => ({ ...EMPTY_FILTER, ...over })

describe('cardMatches', () => {
  it('passes everything with the empty filter', () => {
    expect(cardMatches(card(), EMPTY_FILTER)).toBe(true)
  })

  it('overOnly keeps only overdue cards', () => {
    expect(cardMatches(card({ overdueDays: 0 }), f({ overOnly: true }))).toBe(false)
    expect(cardMatches(card({ overdueDays: 3 }), f({ overOnly: true }))).toBe(true)
  })

  it('flow facet is exact (All passes)', () => {
    expect(cardMatches(card({ flow: 'Payment' }), f({ flow: 'Contract' }))).toBe(false)
    expect(cardMatches(card({ flow: 'Payment' }), f({ flow: 'Payment' }))).toBe(true)
    expect(cardMatches(card({ flow: 'Payment' }), f({ flow: 'All' }))).toBe(true)
  })

  it('priority facet: Gấp (rush) matches rush AND legacy urgent; normal is excluded', () => {
    expect(cardMatches(card({ priority: 'rush' }), f({ priority: 'rush' }))).toBe(true)
    expect(cardMatches(card({ priority: 'urgent' }), f({ priority: 'rush' }))).toBe(true) // Khẩn folded into Gấp
    expect(cardMatches(card({ priority: 'normal' }), f({ priority: 'rush' }))).toBe(false)
  })

  it('text query matches code or contractor, case-insensitive', () => {
    expect(cardMatches(card(), f({ q: 'abc' }))).toBe(true)
    expect(cardMatches(card(), f({ q: '0001' }))).toBe(true)
    expect(cardMatches(card(), f({ q: 'zzz' }))).toBe(false)
  })

  it('combines facets (AND)', () => {
    const c = card({ flow: 'Contract', priority: 'rush', overdueDays: 5, contractor: 'Xyz' })
    expect(cardMatches(c, f({ flow: 'Contract', priority: 'rush', overOnly: true, q: 'xyz' }))).toBe(true)
    expect(cardMatches(c, f({ flow: 'Contract', priority: 'normal' }))).toBe(false)
  })
})

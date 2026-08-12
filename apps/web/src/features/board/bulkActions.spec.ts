import { describe, it, expect } from 'vitest'
import { bulkSelectGroups, commonBulkActions, isBulkable, summarizeBatch, handoverEventOf, HANDOVER_DCC } from './bulkActions'
import type { BoardCard, LegalAction } from './api'

const act = (event: string, over: Partial<LegalAction> = {}): LegalAction => ({
  event,
  label: event,
  toStatus: 'x',
  reversible: true,
  reasonRequired: false,
  ...over,
})
const card = (actions: LegalAction[]): BoardCard =>
  ({ id: 'x', actions } as unknown as BoardCard)

describe('commonBulkActions — actions legal for EVERY selected card', () => {
  it('returns [] when nothing is selected', () => {
    expect(commonBulkActions([])).toEqual([])
  })

  it('keeps only the actions all cards share (by event)', () => {
    const a = card([act('andyApproveComplete'), act('andyRequireBop')])
    const b = card([act('andyApproveComplete')])
    expect(commonBulkActions([a, b]).map((x) => x.event)).toEqual(['andyApproveComplete'])
  })

  it('excludes reason-gated and pseudo (__) actions from bulk', () => {
    const a = card([act('andyApproveComplete'), act('sendBack', { reasonRequired: true }), act('__pick')])
    const b = card([act('andyApproveComplete'), act('sendBack', { reasonRequired: true }), act('__pick')])
    expect(commonBulkActions([a, b]).map((x) => x.event)).toEqual(['andyApproveComplete'])
  })

  it('collapses handoverToDcc2 + handoverToDcc3 into one "Chuyển cho DCC" umbrella', () => {
    const contract = card([act('handoverToDcc2')])
    const payment = card([act('handoverToDcc3')])
    expect(commonBulkActions([contract, payment]).map((x) => x.event)).toEqual([HANDOVER_DCC])
  })

  it('still uses the umbrella for an all-Contract selection (single button, not the raw event)', () => {
    const a = card([act('handoverToDcc2')])
    const b = card([act('handoverToDcc2')])
    expect(commonBulkActions([a, b]).map((x) => x.event)).toEqual([HANDOVER_DCC])
  })

  it('never merges a General decision into the handover umbrella', () => {
    const contract = card([act('handoverToDcc2')])
    const general = card([act('andyApproveComplete')])
    expect(commonBulkActions([contract, general])).toEqual([])
  })
})

describe('isBulkable', () => {
  it('allows DCC2 hardcopy confirm/complete, excludes sendToAccounting, pseudo, reason-gated', () => {
    expect(isBulkable(act('confirmReceivedByDcc2'))).toBe(true)
    expect(isBulkable(act('completeContract'))).toBe(true)
    // sendToAccounting needs a per-ticket number → its own batch sheet, never a bulk.
    expect(isBulkable(act('sendToAccounting'))).toBe(false)
    expect(isBulkable(act('__pick'))).toBe(false)
    expect(isBulkable(act('sendBack', { reasonRequired: true }))).toBe(false)
  })
})

describe('bulkSelectGroups — split "select all" by bulk family', () => {
  const c = (id: string, flow: string): BoardCard => ({ id, flow } as unknown as BoardCard)

  it('single family (all handover: Contract + Payment) → one "all" group', () => {
    const groups = bulkSelectGroups([c('1', 'Contract'), c('2', 'Payment')])
    expect(groups.map((g) => g.key)).toEqual(['all'])
    expect(groups[0]!.cards).toHaveLength(2)
  })

  it('single family (all General) → one "all" group', () => {
    expect(bulkSelectGroups([c('1', 'General'), c('2', 'General')]).map((g) => g.key)).toEqual(['all'])
  })

  it('mixed General + Contract/Payment → two groups, each with its own cards', () => {
    const groups = bulkSelectGroups([c('g1', 'General'), c('c1', 'Contract'), c('p1', 'Payment')])
    expect(groups.map((g) => g.key)).toEqual(['general', 'handover'])
    expect(groups[0]!.cards.map((x) => x.id)).toEqual(['g1'])
    expect(groups[1]!.cards.map((x) => x.id)).toEqual(['c1', 'p1'])
  })

  it('empty selection → one empty "all" group', () => {
    expect(bulkSelectGroups([])).toEqual([{ key: 'all', cards: [] }])
  })
})

describe('handoverEventOf', () => {
  it('returns the card own handover event, or undefined', () => {
    expect(handoverEventOf(card([act('handoverToDcc3')]))).toBe('handoverToDcc3')
    expect(handoverEventOf(card([act('andyApproveComplete')]))).toBeUndefined()
  })
})

describe('summarizeBatch', () => {
  it('counts ok vs failed', () => {
    expect(summarizeBatch([{ ok: true }, { ok: false }, { ok: true }])).toEqual({ ok: 2, failed: 1 })
  })
  it('handles an all-ok batch', () => {
    expect(summarizeBatch([{ ok: true }, { ok: true }])).toEqual({ ok: 2, failed: 0 })
  })
})

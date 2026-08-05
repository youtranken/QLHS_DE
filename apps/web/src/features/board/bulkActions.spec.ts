import { describe, it, expect } from 'vitest'
import { commonBulkActions, summarizeBatch } from './bulkActions'
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
})

describe('summarizeBatch', () => {
  it('counts ok vs failed', () => {
    expect(summarizeBatch([{ ok: true }, { ok: false }, { ok: true }])).toEqual({ ok: 2, failed: 1 })
  })
  it('handles an all-ok batch', () => {
    expect(summarizeBatch([{ ok: true }, { ok: true }])).toEqual({ ok: 2, failed: 0 })
  })
})

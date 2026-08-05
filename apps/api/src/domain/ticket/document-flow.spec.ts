import { describe, it, expect } from 'vitest'
import { DOCUMENT_TYPE, FLOW } from '@qlhs/contracts'
import { mapFlow } from './document-flow'

describe('mapFlow (B1 — document type → flow)', () => {
  it('routes General to the General flow', () => {
    expect(mapFlow(DOCUMENT_TYPE.General)).toBe(FLOW.General)
  })

  it('routes Contract/VO/Annex/Budget to the Contract flow', () => {
    for (const dt of [
      DOCUMENT_TYPE.Contract,
      DOCUMENT_TYPE.VO,
      DOCUMENT_TYPE.Annex,
      DOCUMENT_TYPE.Budget,
    ]) {
      expect(mapFlow(dt)).toBe(FLOW.Contract)
    }
  })

  it('routes Payment to the Payment flow', () => {
    expect(mapFlow(DOCUMENT_TYPE.Payment)).toBe(FLOW.Payment)
  })

  it('never returns A/B/C', () => {
    const values = Object.values(DOCUMENT_TYPE).map(mapFlow)
    expect(values.every((f) => ['General', 'Contract', 'Payment'].includes(f))).toBe(true)
  })
})

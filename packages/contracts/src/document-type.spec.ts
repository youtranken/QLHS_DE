import { describe, expect, it } from 'vitest'
import { ALL_DOCUMENT_TYPES, DOCUMENT_TYPE_GROUPS } from './document-type'
import { FLOW } from './flow'

describe('DOCUMENT_TYPE_GROUPS', () => {
  it('groups by flow in flow order (General → Contract → Payment)', () => {
    expect(DOCUMENT_TYPE_GROUPS.map((g) => g.flow)).toEqual([
      FLOW.General,
      FLOW.Contract,
      FLOW.Payment,
    ])
  })

  it('covers every document type exactly once (no drift vs ALL_DOCUMENT_TYPES)', () => {
    const flat = DOCUMENT_TYPE_GROUPS.flatMap((g) => g.types)
    expect([...flat].sort()).toEqual([...ALL_DOCUMENT_TYPES].sort())
    expect(flat.length).toBe(new Set(flat).size)
  })

  it('routes Contract/VO/Annex/Budget under the Contract flow', () => {
    const contract = DOCUMENT_TYPE_GROUPS.find((g) => g.flow === FLOW.Contract)
    expect(contract?.types).toEqual(['Contract', 'VO', 'Annex', 'Budget'])
  })
})

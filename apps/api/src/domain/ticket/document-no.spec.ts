import { describe, it, expect } from 'vitest'
import { isValidDocumentNo } from './document-no'

describe('Document No (FR-11, free-form — non-empty only)', () => {
  it('accepts any non-empty value (formats vary in practice)', () => {
    for (const ok of ['26-CC-01-CT', 'HD-2026/123', 'ACME 998', '  x  ']) {
      expect(isValidDocumentNo(ok)).toBe(true)
    }
  })

  it('rejects only empty / whitespace-only values', () => {
    for (const bad of ['', '   ', '\t']) {
      expect(isValidDocumentNo(bad)).toBe(false)
    }
  })

  it('rejects an oversized value (length ceiling guards the btree index)', () => {
    expect(isValidDocumentNo('x'.repeat(200))).toBe(true)
    expect(isValidDocumentNo('x'.repeat(201))).toBe(false)
  })

  it("rejects the reserved 'N/A' sentinel (any case) so it can't dodge the unique index", () => {
    for (const bad of ['N/A', 'n/a', ' N/a ']) {
      expect(isValidDocumentNo(bad)).toBe(false)
    }
  })
})

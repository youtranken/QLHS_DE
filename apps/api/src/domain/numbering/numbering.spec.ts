import { describe, it, expect } from 'vitest'
import { FLOW } from '@qlhs/contracts'
import { prefixForFlow, formatCode } from './numbering'

describe('prefixForFlow (PRD §3.3)', () => {
  it('General → G', () => {
    expect(prefixForFlow(FLOW.General)).toBe('G')
  })
  it('Contract and Payment → CT', () => {
    expect(prefixForFlow(FLOW.Contract)).toBe('CT')
    expect(prefixForFlow(FLOW.Payment)).toBe('CT')
  })
})

describe('formatCode', () => {
  it('zero-pads to 4 digits', () => {
    expect(formatCode('G', 2026, 1)).toBe('G-2026-0001')
    expect(formatCode('CT', 2026, 42)).toBe('CT-2026-0042')
  })
  it('does not truncate past 4 digits', () => {
    expect(formatCode('G', 2026, 12345)).toBe('G-2026-12345')
  })
})

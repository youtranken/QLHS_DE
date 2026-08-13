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
  it('zero-pads the sequence to 4 digits, year last', () => {
    expect(formatCode('G', 2026, 1)).toBe('G-0001-2026')
    expect(formatCode('CT', 2026, 42)).toBe('CT-0042-2026')
  })
  it('does not truncate the sequence past 4 digits', () => {
    expect(formatCode('G', 2026, 12345)).toBe('G-12345-2026')
  })
})

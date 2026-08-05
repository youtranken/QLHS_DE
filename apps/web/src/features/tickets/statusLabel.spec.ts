import { describe, it, expect } from 'vitest'
import { TICKET_STATUS } from '@qlhs/contracts'
import { statusVi } from './statusLabel'

describe('statusVi', () => {
  it('has a Vietnamese label for EVERY canonical status (no raw fallback)', () => {
    for (const status of Object.values(TICKET_STATUS)) {
      const label = statusVi(status)
      expect(label, `missing VI label for "${status}"`).not.toBe(status)
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('falls back to the raw string for an unknown status', () => {
    expect(statusVi('Not A Status')).toBe('Not A Status')
  })
})

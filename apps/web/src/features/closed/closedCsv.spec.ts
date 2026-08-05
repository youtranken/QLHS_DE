import { describe, it, expect } from 'vitest'
import { closedCsvRows } from './closedCsv'
import type { TicketView } from '../tickets/api'

const tk = (over: Partial<TicketView> = {}): TicketView =>
  ({
    id: 'abcdef12-0000',
    code: 'B-2026-0007',
    flow: 'Contract',
    contractor: 'Cty ABC',
    amount: 1500000,
    currency: 'VND',
    contractNo: 'HD-01',
    createdAt: '2026-07-01T00:00:00.000Z',
    status: 'Completed',
    ...over,
  }) as unknown as TicketView

describe('closedCsvRows', () => {
  it('maps a ticket to the on-screen column order', () => {
    expect(closedCsvRows([tk()])[0]).toEqual([
      'B-2026-0007',
      'Contract',
      'Cty ABC',
      '1500000',
      'VND',
      'HD-01',
      '2026-07-01T00:00:00.000Z',
      'Completed',
    ])
  })

  it('falls back to a short id and blanks for missing fields', () => {
    const [row] = closedCsvRows([
      tk({ code: undefined, contractor: null, amount: null, contractNo: null }),
    ])
    expect(row).toEqual([
      'abcdef12',
      'Contract',
      '',
      '',
      'VND',
      '',
      '2026-07-01T00:00:00.000Z',
      'Completed',
    ])
  })
})

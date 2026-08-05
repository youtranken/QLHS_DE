import { describe, it, expect } from 'vitest'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateTicketDto } from './create-ticket.dto'

// A well-formed payload used as the baseline; each test tweaks one field so a
// failure pins the exact bound being exercised.
function base(): Record<string, unknown> {
  return {
    documentType: 'General',
    description: 'Thanh toán đợt 1',
    paymentTerm: 'Net 30',
    contractNo: 'HD-2026-001',
    projectTeam: 'Team A',
    currency: 'VND',
    amount: '1000000',
    budgetCode: 'BC-01',
    contractor: 'Công ty ABC',
  }
}

async function errors(payload: Record<string, unknown>) {
  return validate(plainToInstance(CreateTicketDto, payload))
}

describe('CreateTicketDto — free-text length bounds', () => {
  it('accepts a normal, in-bounds payload', async () => {
    expect(await errors(base())).toHaveLength(0)
  })

  it('rejects an over-long description', async () => {
    const errs = await errors({ ...base(), description: 'x'.repeat(4001) })
    expect(errs.some((e) => e.property === 'description')).toBe(true)
  })

  it('rejects an over-long contractNo', async () => {
    const errs = await errors({ ...base(), contractNo: 'x'.repeat(201) })
    expect(errs.some((e) => e.property === 'contractNo')).toBe(true)
  })

  it('rejects an over-long contractor', async () => {
    const errs = await errors({ ...base(), contractor: 'x'.repeat(201) })
    expect(errs.some((e) => e.property === 'contractor')).toBe(true)
  })

  it('rejects an over-long amount (digit-count ceiling)', async () => {
    const errs = await errors({ ...base(), amount: '1'.repeat(21) })
    expect(errs.some((e) => e.property === 'amount')).toBe(true)
  })

  // The overflow band: 19 digits can exceed int8 max (9223372036854775807) and
  // would 500 at INSERT. The 18-digit ceiling keeps every accepted value in range.
  it('rejects a 19-digit amount (int8 overflow band)', async () => {
    const errs = await errors({ ...base(), amount: '9'.repeat(19) })
    expect(errs.some((e) => e.property === 'amount')).toBe(true)
  })

  it('accepts an 18-digit amount (boundary, always fits int8)', async () => {
    const errs = await errors({ ...base(), amount: '9'.repeat(18) })
    expect(errs.some((e) => e.property === 'amount')).toBe(false)
  })

  it('still rejects a non-numeric amount', async () => {
    const errs = await errors({ ...base(), amount: '12.5' })
    expect(errs.some((e) => e.property === 'amount')).toBe(true)
  })

  it('accepts a max-length description (boundary)', async () => {
    const errs = await errors({ ...base(), description: 'x'.repeat(4000) })
    expect(errs.some((e) => e.property === 'description')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { DOCUMENT_TYPE, FLOW } from '@qlhs/contracts'
import { cloneFields, diffFields, normalizeContractNo, type ApplicantFields } from './applicant-fields'

const SRC: ApplicantFields = {
  documentType: DOCUMENT_TYPE.Contract,
  description: 'Mua vật tư',
  paymentTerm: '30 ngày',
  contractNo: 'HD-2026-001',
  projectTeam: 'Team A',
  currency: 'VND',
  amount: 15000000n,
  budgetCode: 'BUD-01',
  contractor: 'Nhà thầu X',
}

describe('cloneFields (FR-3 — clone copies only the 9 fields)', () => {
  it('copies every one of the 9 fields', () => {
    expect(cloneFields(SRC)).toEqual(SRC)
  })

  it('does not carry over code / round / DCC / timeline (they are not fields)', () => {
    const withExtra = { ...SRC, code: 'CT-2026-0001', roundNo: 3, paymentNo: 'X' }
    const cloned = cloneFields(withExtra as ApplicantFields)
    expect('code' in cloned).toBe(false)
    expect('roundNo' in cloned).toBe(false)
    expect('paymentNo' in cloned).toBe(false)
    expect(Object.keys(cloned)).toHaveLength(9)
  })
})

describe('normalizeContractNo (AD-16 — Contract No is DCC2-owned, enforced server-side)', () => {
  it('forces the Contract-flow applicant slot to N/A, discarding any supplied number', () => {
    expect(normalizeContractNo({ ...SRC, contractNo: 'CT-ACC-42' }, FLOW.Contract).contractNo).toBe('N/A')
  })

  it('keeps the Payment reference but uppercases it (case-fold like Contract No)', () => {
    expect(normalizeContractNo({ ...SRC, contractNo: 'pmt-a1' }, FLOW.Payment).contractNo).toBe('PMT-A1')
  })

  it('uppercases the General reference too', () => {
    expect(normalizeContractNo({ ...SRC, contractNo: 'ref-9' }, FLOW.General).contractNo).toBe('REF-9')
  })

  it('does not mutate its input', () => {
    const input = { ...SRC, contractNo: 'HD-1' }
    normalizeContractNo(input, FLOW.Contract)
    expect(input.contractNo).toBe('HD-1')
  })
})

describe('diffFields (B6 — one field_changed per actually-changed field)', () => {
  it('returns nothing when nothing changed', () => {
    expect(diffFields(SRC, { ...SRC })).toEqual([])
  })

  it('reports only changed fields, with stringified old/new (bigint-safe)', () => {
    const next: ApplicantFields = { ...SRC, description: 'Sửa mô tả', amount: 20000000n }
    const changes = diffFields(SRC, next)
    expect(changes).toEqual([
      { field: 'description', old: 'Mua vật tư', new: 'Sửa mô tả' },
      { field: 'amount', old: '15000000', new: '20000000' },
    ])
  })
})

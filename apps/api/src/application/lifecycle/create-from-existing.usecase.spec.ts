import { describe, it, expect, vi } from 'vitest'
import { CreateFromExistingUseCase } from './create-from-existing.usecase'
import { FlowResolver } from './flow-resolver'

const source = (documentType: string) => ({
  documentType,
  description: 'x',
  paymentTerm: 'N/A',
  contractNo: 'N/A',
  projectTeam: 'T',
  currency: 'VND',
  amount: 100n,
  budgetCode: 'N/A',
  contractor: 'N/A',
})

function make(catalogFlow: string | null, src: unknown) {
  const repo = { findByIdForApplicant: vi.fn().mockResolvedValue(src) }
  const writes = { create: vi.fn().mockResolvedValue({ id: 't2' }) }
  const options = { flowForDocType: vi.fn().mockResolvedValue(catalogFlow), isDocTypeHidden: vi.fn().mockResolvedValue(false) }
  const uc = new CreateFromExistingUseCase(repo as never, writes as never, new FlowResolver(options as never))
  return { uc, writes }
}

describe('CreateFromExistingUseCase — flow resolved from catalog (FR-3)', () => {
  it('resolves an admin-added type via the catalog (no 500 from undefined flow)', async () => {
    const { uc, writes } = make('Payment', source('Loại admin thêm'))
    await uc.execute({ applicantSub: 'a', sourceTicketId: 't1' })
    expect(writes.create).toHaveBeenCalledWith(expect.objectContaining({ flow: 'Payment' }))
  })

  it('falls back to mapFlow for a built-in type', async () => {
    const { uc, writes } = make(null, source('General'))
    await uc.execute({ applicantSub: 'a', sourceTicketId: 't1' })
    expect(writes.create).toHaveBeenCalledWith(expect.objectContaining({ flow: 'General' }))
  })
})

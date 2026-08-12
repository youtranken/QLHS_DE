import { describe, it, expect, vi } from 'vitest'
import { UpdateFieldsUseCase } from './update-fields.usecase'
import { FlowResolver } from './flow-resolver'

const fields = (documentType: string) =>
  ({
    documentType,
    description: 'x',
    paymentTerm: 'N/A',
    contractNo: 'N/A',
    projectTeam: 'T',
    currency: 'VND',
    amount: 0n,
    budgetCode: 'N/A',
    contractor: 'N/A',
  }) as never

function make(catalogFlow: string | null) {
  const repo = { updateFields: vi.fn().mockResolvedValue(undefined) }
  const options = { flowForDocType: vi.fn().mockResolvedValue(catalogFlow), isDocTypeHidden: vi.fn().mockResolvedValue(false) }
  const uc = new UpdateFieldsUseCase(repo as never, new FlowResolver(options as never))
  return { uc, repo }
}

describe('UpdateFieldsUseCase — flow resolved from catalog (not bare mapFlow)', () => {
  it('hands the CATALOG flow to the repo for an admin-added type (no desync)', async () => {
    const { uc, repo } = make('Payment')
    await uc.execute({ ticketId: 't1', actorSub: 'a', fields: fields('Loại admin thêm') })
    expect(repo.updateFields).toHaveBeenCalledWith('t1', 'a', expect.anything(), 'Payment')
  })

  it('falls back to mapFlow for a built-in type', async () => {
    const { uc, repo } = make(null)
    await uc.execute({ ticketId: 't1', actorSub: 'a', fields: fields('Contract') })
    expect(repo.updateFields).toHaveBeenCalledWith('t1', 'a', expect.anything(), 'Contract')
  })

  it('rejects an unknown documentType and never writes', async () => {
    const { uc, repo } = make(null)
    await expect(uc.execute({ ticketId: 't1', actorSub: 'a', fields: fields('ZZZ lạ') })).rejects.toThrow()
    expect(repo.updateFields).not.toHaveBeenCalled()
  })
})

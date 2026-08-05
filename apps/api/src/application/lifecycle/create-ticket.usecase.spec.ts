import { describe, it, expect, vi } from 'vitest'
import { CreateTicketUseCase } from './create-ticket.usecase'

function make(catalogFlow: string | null) {
  const repo = { create: vi.fn().mockResolvedValue({ id: 't1' }) }
  const options = { flowForDocType: vi.fn().mockResolvedValue(catalogFlow) }
  return { uc: new CreateTicketUseCase(repo as never, options as never), repo }
}

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

const req = (documentType: string) => ({ applicantSub: 'a', fields: fields(documentType), priority: 'normal' as never })

describe('CreateTicketUseCase — suy luồng document type', () => {
  it('dùng flow từ catalog (loại admin thêm)', async () => {
    const { uc, repo } = make('Payment')
    await uc.execute(req('Loại tự thêm'))
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ flow: 'Payment' }))
  })

  it('fallback mapFlow cho 6 built-in khi catalog chưa có', async () => {
    const { uc, repo } = make(null)
    await uc.execute(req('Contract'))
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ flow: 'Contract' }))
  })

  it('từ chối loại không xác định được luồng (không catalog, không built-in)', async () => {
    const { uc, repo } = make(null)
    await expect(uc.execute(req('Loại lạ ZZZ'))).rejects.toThrow()
    expect(repo.create).not.toHaveBeenCalled()
  })
})

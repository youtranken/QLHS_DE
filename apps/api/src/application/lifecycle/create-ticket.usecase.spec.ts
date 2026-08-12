import { describe, it, expect, vi } from 'vitest'
import { CreateTicketUseCase } from './create-ticket.usecase'
import { FlowResolver } from './flow-resolver'

function make(catalogFlow: string | null, hidden = false) {
  const repo = { create: vi.fn().mockResolvedValue({ id: 't1' }) }
  const options = {
    flowForDocType: vi.fn().mockResolvedValue(catalogFlow),
    isDocTypeHidden: vi.fn().mockResolvedValue(hidden),
  }
  const flow = new FlowResolver(options as never)
  return { uc: new CreateTicketUseCase(repo as never, flow), repo }
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

  it('từ chối loại ĐÃ BỊ ẨN, kể cả built-in (không lọt qua fallback mapFlow)', async () => {
    // flowForDocType trả null (loại inactive) nhưng row tồn tại & bị ẩn → phải từ
    // chối, KHÔNG được fallback mapFlow tạo lại loại built-in admin đã gỡ.
    const { uc, repo } = make(null, true)
    await expect(uc.execute(req('Contract'))).rejects.toThrow()
    expect(repo.create).not.toHaveBeenCalled()
  })
})

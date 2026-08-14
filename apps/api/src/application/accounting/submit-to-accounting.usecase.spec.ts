import { describe, it, expect, vi } from 'vitest'
import { SubmitToAccountingUseCase } from './submit-to-accounting.usecase'
import { DocumentNoInvalidError } from '../core/ticket-errors'

function make(caps: { requiresContractNo: boolean }, documentType = 'Contract') {
  const submitToAccounting = vi.fn().mockResolvedValue({ status: 'Submitted to Accounting' })
  const tickets = { findById: vi.fn().mockResolvedValue({ id: 't1', documentType }) }
  const options = {
    docTypeCapabilities: vi.fn().mockResolvedValue({
      requiresContractNo: caps.requiresContractNo,
      allowSkip: false,
    }),
  }
  const clock = { now: () => new Date('2026-08-14T00:00:00.000Z') }
  const uc = new SubmitToAccountingUseCase(
    { submitToAccounting } as never,
    tickets as never,
    options as never,
    clock as never,
  )
  return { uc, submitToAccounting }
}

describe('SubmitToAccountingUseCase — theo cờ requiresContractNo', () => {
  it('loại yêu cầu số + để trống → báo lỗi (không gửi)', async () => {
    const { uc, submitToAccounting } = make({ requiresContractNo: true })
    await expect(uc.execute({ ticketId: 't1', actorSub: 'u1', documentNo: '   ' })).rejects.toBeInstanceOf(
      DocumentNoInvalidError,
    )
    expect(submitToAccounting).not.toHaveBeenCalled()
  })

  it('loại yêu cầu số + có số → gửi số đã trim', async () => {
    const { uc, submitToAccounting } = make({ requiresContractNo: true })
    await uc.execute({ ticketId: 't1', actorSub: 'u1', documentNo: '  HD-9 ' })
    expect(submitToAccounting).toHaveBeenCalledWith('t1', expect.anything(), 'HD-9', expect.any(Date))
  })

  it('loại KHÔNG yêu cầu số + để trống → gửi thẳng với N/A', async () => {
    const { uc, submitToAccounting } = make({ requiresContractNo: false }, 'VO')
    await uc.execute({ ticketId: 't1', actorSub: 'u1', documentNo: '' })
    expect(submitToAccounting).toHaveBeenCalledWith('t1', expect.anything(), 'N/A', expect.any(Date))
  })
})

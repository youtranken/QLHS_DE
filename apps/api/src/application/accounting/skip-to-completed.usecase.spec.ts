import { describe, it, expect, vi } from 'vitest'
import { SkipToCompletedUseCase } from './skip-to-completed.usecase'

function make(caps: { allowSkip: boolean; requiresContractNo?: boolean } = { allowSkip: true }) {
  const skip = vi.fn().mockResolvedValue({ status: 'Completed' })
  const clock = { now: () => new Date('2026-08-13T00:00:00.000Z') }
  const tickets = { findById: vi.fn().mockResolvedValue({ id: 't1', documentType: 'Budget' }) }
  const options = {
    docTypeCapabilities: vi.fn().mockResolvedValue({
      requiresContractNo: caps.requiresContractNo ?? false,
      allowSkip: caps.allowSkip,
    }),
  }
  const uc = new SkipToCompletedUseCase(
    { skip } as never,
    tickets as never,
    options as never,
    clock as never,
  )
  return { uc, skip }
}

describe('SkipToCompletedUseCase', () => {
  it('không truyền số → dùng N/A', async () => {
    const { uc, skip } = make()
    await uc.execute({ ticketId: 't1', actorSub: 'u1' })
    expect(skip).toHaveBeenCalledWith('t1', 'u1', 'N/A', expect.any(Date))
  })

  it('số toàn khoảng trắng → N/A', async () => {
    const { uc, skip } = make()
    await uc.execute({ ticketId: 't1', actorSub: 'u1', documentNo: '   ' })
    expect(skip).toHaveBeenCalledWith('t1', 'u1', 'N/A', expect.any(Date))
  })

  it('có số → truyền số đã trim', async () => {
    const { uc, skip } = make()
    await uc.execute({ ticketId: 't1', actorSub: 'u1', documentNo: '  CT-01 ' })
    expect(skip).toHaveBeenCalledWith('t1', 'u1', 'CT-01', expect.any(Date))
  })

  it('trả về status từ repo', async () => {
    const { uc } = make()
    await expect(uc.execute({ ticketId: 't1', actorSub: 'u1' })).resolves.toEqual({
      status: 'Completed',
    })
  })

  it('loại KHÔNG bật allowSkip → chặn (không gọi repo)', async () => {
    const { uc, skip } = make({ allowSkip: false })
    await expect(uc.execute({ ticketId: 't1', actorSub: 'u1' })).rejects.toThrow()
    expect(skip).not.toHaveBeenCalled()
  })

  it('loại CẢ hai cờ (Service Contract) + skip mà bỏ trống số → chặn (bắt buộc số)', async () => {
    const { uc, skip } = make({ allowSkip: true, requiresContractNo: true })
    await expect(uc.execute({ ticketId: 't1', actorSub: 'u1', documentNo: '  ' })).rejects.toThrow()
    expect(skip).not.toHaveBeenCalled()
  })

  it('loại CẢ hai cờ + skip kèm số hợp lệ → gửi số đã trim', async () => {
    const { uc, skip } = make({ allowSkip: true, requiresContractNo: true })
    await uc.execute({ ticketId: 't1', actorSub: 'u1', documentNo: '  SC-77 ' })
    expect(skip).toHaveBeenCalledWith('t1', 'u1', 'SC-77', expect.any(Date))
  })
})

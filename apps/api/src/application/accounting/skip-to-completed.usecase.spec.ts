import { describe, it, expect, vi } from 'vitest'
import { SkipToCompletedUseCase } from './skip-to-completed.usecase'

function make() {
  const skip = vi.fn().mockResolvedValue({ status: 'Completed' })
  const clock = { now: () => new Date('2026-08-13T00:00:00.000Z') }
  const uc = new SkipToCompletedUseCase({ skip } as never, clock as never)
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
})

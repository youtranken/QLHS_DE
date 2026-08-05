import { describe, it, expect, vi } from 'vitest'
import { UpdateOptionUseCase } from './mutate-option.usecase'

function repoWith(row: { id: string; kind: string; value: string; active: boolean }) {
  return {
    findById: vi.fn().mockResolvedValue(row),
    findByValue: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(row),
  }
}

describe('UpdateOptionUseCase — Document Type is add-only server-side', () => {
  it('rejects renaming OR deactivating a documentType row (không chỉ ẩn UI)', async () => {
    const repo = repoWith({ id: 'd1', kind: 'documentType', value: 'Contract', active: true })
    const uc = new UpdateOptionUseCase(repo as never)
    await expect(uc.execute('d1', { value: 'Đổi tên' })).rejects.toThrow()
    await expect(uc.execute('d1', { active: false })).rejects.toThrow()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('still allows editing a normal catalog kind (paymentTerm)', async () => {
    const repo = repoWith({ id: 'p1', kind: 'paymentTerm', value: 'NET30', active: true })
    const uc = new UpdateOptionUseCase(repo as never)
    await uc.execute('p1', { value: 'NET45' })
    expect(repo.update).toHaveBeenCalledWith('p1', { value: 'NET45' })
  })
})

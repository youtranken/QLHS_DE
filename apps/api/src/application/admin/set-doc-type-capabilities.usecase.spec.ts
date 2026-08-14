import { describe, it, expect, vi } from 'vitest'
import { SetDocTypeCapabilitiesUseCase } from './set-doc-type-capabilities.usecase'

function make() {
  const setDocTypeCapabilities = vi.fn().mockResolvedValue({ id: 'd1' })
  const uc = new SetDocTypeCapabilitiesUseCase({ setDocTypeCapabilities } as never)
  return { uc, setDocTypeCapabilities }
}

describe('SetDocTypeCapabilitiesUseCase — hai cờ độc lập (không loại trừ)', () => {
  it('bật requiresContractNo → KHÔNG đụng allowSkip', async () => {
    const { uc, setDocTypeCapabilities } = make()
    await uc.execute('d1', { requiresContractNo: true })
    expect(setDocTypeCapabilities).toHaveBeenCalledWith('d1', { requiresContractNo: true })
  })

  it('bật allowSkip → KHÔNG đụng requiresContractNo', async () => {
    const { uc, setDocTypeCapabilities } = make()
    await uc.execute('d1', { allowSkip: true })
    expect(setDocTypeCapabilities).toHaveBeenCalledWith('d1', { allowSkip: true })
  })

  it('bật CẢ hai cờ (vd Service Contract) → truyền nguyên vẹn, không clear chéo', async () => {
    const { uc, setDocTypeCapabilities } = make()
    await uc.execute('d1', { requiresContractNo: true, allowSkip: true })
    expect(setDocTypeCapabilities).toHaveBeenCalledWith('d1', {
      requiresContractNo: true,
      allowSkip: true,
    })
  })

  it('id không phải loại Contract → 400', async () => {
    const setDocTypeCapabilities = vi.fn().mockResolvedValue(null)
    const uc = new SetDocTypeCapabilitiesUseCase({ setDocTypeCapabilities } as never)
    await expect(uc.execute('x', { allowSkip: true })).rejects.toThrow()
  })
})

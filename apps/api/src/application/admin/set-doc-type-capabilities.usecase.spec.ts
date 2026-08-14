import { describe, it, expect, vi } from 'vitest'
import { SetDocTypeCapabilitiesUseCase } from './set-doc-type-capabilities.usecase'

function make() {
  const setDocTypeCapabilities = vi.fn().mockResolvedValue({ id: 'd1' })
  const uc = new SetDocTypeCapabilitiesUseCase({ setDocTypeCapabilities } as never)
  return { uc, setDocTypeCapabilities }
}

describe('SetDocTypeCapabilitiesUseCase — hai cờ loại trừ nhau', () => {
  it('bật requiresContractNo → tự tắt allowSkip', async () => {
    const { uc, setDocTypeCapabilities } = make()
    await uc.execute('d1', { requiresContractNo: true })
    expect(setDocTypeCapabilities).toHaveBeenCalledWith('d1', {
      requiresContractNo: true,
      allowSkip: false,
    })
  })

  it('bật allowSkip → tự tắt requiresContractNo', async () => {
    const { uc, setDocTypeCapabilities } = make()
    await uc.execute('d1', { allowSkip: true })
    expect(setDocTypeCapabilities).toHaveBeenCalledWith('d1', {
      allowSkip: true,
      requiresContractNo: false,
    })
  })

  it('tắt một cờ → KHÔNG đụng cờ kia', async () => {
    const { uc, setDocTypeCapabilities } = make()
    await uc.execute('d1', { requiresContractNo: false })
    expect(setDocTypeCapabilities).toHaveBeenCalledWith('d1', { requiresContractNo: false })
  })

  it('id không phải loại Contract → 400', async () => {
    const setDocTypeCapabilities = vi.fn().mockResolvedValue(null)
    const uc = new SetDocTypeCapabilitiesUseCase({ setDocTypeCapabilities } as never)
    await expect(uc.execute('x', { allowSkip: true })).rejects.toThrow()
  })
})

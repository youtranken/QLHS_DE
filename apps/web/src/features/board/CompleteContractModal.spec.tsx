import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { CompleteContractModal } from './CompleteContractModal'

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<CompleteContractModal code="CT-2026-0001" onSubmit={onSubmit} onClose={vi.fn()} />)
  return { onSubmit }
}

describe('CompleteContractModal (FR-12 — scan path, irreversible)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('blocks an empty scan path (aria-invalid, no submit)', () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('confirms the consequence before completing (irreversible)', async () => {
    const { onSubmit } = setup()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '\\\\share\\a.pdf' } })
    // "Hoàn tất" opens a danger ConfirmModal; cancelling it must not submit.
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }))
    const confirmDialog = (await screen.findAllByRole('dialog')).at(-1)!
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Hủy' }))
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tất & đóng hồ sơ' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('\\\\share\\a.pdf'))
  })
})

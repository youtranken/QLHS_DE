import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HandoverModal } from './HandoverModal'

function setup(over: Partial<Parameters<typeof HandoverModal>[0]> = {}) {
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const onMissing = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <HandoverModal code="CT-2026-0001" onConfirm={onConfirm} onMissing={onMissing} onClose={onClose} {...over} />,
  )
  return { onConfirm, onMissing, onClose }
}

describe('HandoverModal — 2-phase confirmation (UX-DR8, AC2/AC3)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('is a labelled modal dialog and focuses inside on open', async () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
  })

  it('ESC closes the modal', () => {
    const { onClose } = setup()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('"Đã nhận bản cứng" confirms with the default (today) date', async () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Đã nhận bản cứng' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('"Thiếu giấy" is irreversible — asks for confirmation before bouncing', async () => {
    const { onMissing } = setup()
    // Opens the danger ConfirmModal; cancelling it must not bounce.
    fireEvent.click(screen.getByRole('button', { name: 'Thiếu giấy, trả về DCC1' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }))
    expect(onMissing).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Thiếu giấy, trả về DCC1' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Trả về DCC1' }))
    await waitFor(() => expect(onMissing).toHaveBeenCalledTimes(1))
  })
})

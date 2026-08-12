import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

  it('"Xác nhận" confirms with the default (today) date', async () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('"Trả về DCC1" is irreversible — asks for confirmation before bouncing', async () => {
    const { onMissing } = setup()
    // Opens the danger ConfirmModal; cancelling it must not bounce. Only the handover
    // dialog is open here, so its trigger button is the sole "Trả về DCC1".
    fireEvent.click(screen.getByRole('button', { name: 'Trả về DCC1' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }))
    expect(onMissing).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Trả về DCC1' }))
    // A reason is required before the bounce is enabled. The confirm dialog is nested
    // inside the handover dialog and its confirm button shares the label, so scope to
    // the last dialog to disambiguate from the trigger.
    const confirm = within((await screen.findAllByRole('dialog')).at(-1) as HTMLElement)
    fireEvent.change(confirm.getByRole('textbox'), { target: { value: 'Thiếu trang 3' } })
    fireEvent.click(confirm.getByRole('button', { name: 'Trả về DCC1' }))
    await waitFor(() => expect(onMissing).toHaveBeenCalledWith('Thiếu trang 3'))
  })
})

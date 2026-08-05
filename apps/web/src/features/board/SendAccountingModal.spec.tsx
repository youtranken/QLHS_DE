import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SendAccountingModal } from './SendAccountingModal'
import { ApiClientError } from '../../shared/api-client'

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn()
  render(<SendAccountingModal code="CT-2026-0001" onSubmit={onSubmit} onClose={onClose} />)
  return { onSubmit, onClose }
}

describe('SendAccountingModal (FR-11 — Document No)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('blocks an empty Document No client-side (no submit, aria-invalid)', () => {
    const { onSubmit } = setup()
    // Free-form now — only an empty/whitespace value is rejected.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi ACC' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('submits any non-empty Document No (free-form)', async () => {
    const { onSubmit } = setup()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'HD-2026/123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi ACC' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('HD-2026/123'))
  })

  it('surfaces a server 409 duplicate in the alert (stays open)', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiClientError(409, 'DocumentNoDuplicate', 'dup'))
    setup(onSubmit)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '26-CC-99-CT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi ACC' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('đã tồn tại'))
  })

  it('with a note (Payment) gates the POST behind a danger confirm (H5)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <SendAccountingModal
        code="CT-2026-0002"
        note="Gửi ACC sẽ đóng hồ sơ ngay và không thể hoàn tác."
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '26-CC-02-CT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi ACC' }))
    // First click only opens the confirm — no POST yet.
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi ACC & đóng hồ sơ' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('26-CC-02-CT'))
  })
})

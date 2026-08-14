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
    fireEvent.click(screen.getByRole('button', { name: 'Gửi Accounting' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('submits any non-empty Document No (free-form)', async () => {
    const { onSubmit } = setup()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'HD-2026/123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi Accounting' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('HD-2026/123'))
  })

  it('surfaces a server 409 duplicate in the alert (stays open)', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiClientError(409, 'DocumentNoDuplicate', 'dup'))
    setup(onSubmit)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '26-CC-99-CT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi Accounting' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('đã tồn tại'))
  })

  it('loại chỉ-Skip (requireDocNo=false): tick Skip gates onSkip qua confirm; số để trống được (N/A)', async () => {
    const onSkip = vi.fn().mockResolvedValue(undefined)
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <SendAccountingModal
        code="CT-2026-0003"
        requireDocNo={false}
        allowSkip
        onSkip={onSkip}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    )
    // Skip-only type has no number field — ticking Skip closes with a blank (→ N/A).
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }))
    // First click only opens the confirm — nothing posted yet.
    expect(onSkip).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận hoàn tất' }))
    await waitFor(() => expect(onSkip).toHaveBeenCalledWith(''))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('loại CẢ hai cờ (requireDocNo + allowSkip): Skip mà bỏ trống số → chặn, có số → onSkip(số)', async () => {
    const onSkip = vi.fn().mockResolvedValue(undefined)
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <SendAccountingModal
        code="CT-2026-0004"
        requireDocNo
        allowSkip
        onSkip={onSkip}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    )
    // Tick Skip but leave the number blank → blocked (number mandatory for this type).
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onSkip).not.toHaveBeenCalled()
    // Enter a number → Skip proceeds through the confirm with that number.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'SC-77' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận hoàn tất' }))
    await waitFor(() => expect(onSkip).toHaveBeenCalledWith('SC-77'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('no Skip checkbox unless allowSkip (Payment/DCC3 never sees it)', () => {
    setup()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('confirmClose (Payment) gates the POST behind a danger confirm (H5), no scary note', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <SendAccountingModal
        code="CT-2026-0002"
        docLabel="Payment No"
        confirmClose
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    )
    // The Payment field is labelled "Payment No"; the old warning text is gone.
    expect(screen.getByText('Payment No')).toBeInTheDocument()
    expect(screen.queryByText(/không thể hoàn tác|không email Applicant/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'PN-2026-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi Accounting' }))
    // First click only opens the confirm — no POST yet.
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi Accounting & đóng hồ sơ' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('PN-2026-02'))
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./api', () => ({ sendAccounting: vi.fn(), sendAccountingDcc3: vi.fn() }))
vi.mock('../../shared/toast', () => ({ toast: { ok: vi.fn(), info: vi.fn(), err: vi.fn() } }))
import { sendAccounting, type BoardCard } from './api'
import { BatchSendAccountingModal } from './BatchSendAccountingModal'

const card = (id: string, code: string): BoardCard => ({
  id, code, contractor: 'ACME', amount: '1000000', priority: 'normal', flow: 'Contract',
  status: 'Received by DCC2', overdueDays: 0, lockedByMe: false, lockedBy: null,
  actions: [{ event: 'sendToAccounting', label: 'x', toStatus: 'Submitted to Accounting', reversible: false, reasonRequired: false }],
})

const cards = [card('t1', 'CT-1'), card('t2', 'CT-2'), card('t3', 'CT-3')]

describe('BatchSendAccountingModal — enter many numbers at once', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends only the filled rows and skips the blanks, then closes', async () => {
    vi.mocked(sendAccounting).mockResolvedValue({ status: 'Submitted to Accounting' })
    const onClose = vi.fn()
    const onDone = vi.fn().mockResolvedValue(undefined)
    render(<BatchSendAccountingModal cards={cards} onClose={onClose} onDone={onDone} />)

    const inputs = screen.getAllByPlaceholderText('Contract No')
    expect(inputs).toHaveLength(3)
    fireEvent.change(inputs[0]!, { target: { value: '26-CC-1' } })
    fireEvent.change(inputs[2]!, { target: { value: '26-CC-3' } }) // leave row 2 blank

    fireEvent.click(screen.getByRole('button', { name: /Gửi 2 hồ sơ/ }))

    await waitFor(() => expect(sendAccounting).toHaveBeenCalledTimes(2))
    expect(sendAccounting).toHaveBeenCalledWith('t1', '26-CC-1')
    expect(sendAccounting).toHaveBeenCalledWith('t3', '26-CC-3')
    expect(sendAccounting).not.toHaveBeenCalledWith('t2', expect.anything()) // blank skipped
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('keeps a failed (e.g. duplicate) row with its error and does NOT close', async () => {
    vi.mocked(sendAccounting).mockRejectedValue(new Error('dup'))
    const onClose = vi.fn()
    render(<BatchSendAccountingModal cards={cards} onClose={onClose} onDone={vi.fn().mockResolvedValue(undefined)} />)

    fireEvent.change(screen.getAllByPlaceholderText('Contract No')[0]!, { target: { value: '26-CC-1' } })
    fireEvent.click(screen.getByRole('button', { name: /Gửi 1 hồ sơ/ }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
    // The row is still editable so the user can fix + resend.
    expect(screen.getAllByPlaceholderText('Contract No').length).toBeGreaterThan(0)
  })
})

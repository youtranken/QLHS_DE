import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('./api', () => ({
  searchClosed: vi.fn(),
  reopenClosed: vi.fn(),
  requestReopen: vi.fn(),
}))
import { searchClosed, reopenClosed, requestReopen } from './api'
import { ClosedTickets } from './ClosedTickets'

const ROW = {
  id: 't1', code: 'CT-2026-0001', status: 'Completed', flow: 'Contract', priority: 'normal',
  documentType: 'Contract', description: null, paymentTerm: null, contractNo: 'HD-1',
  projectTeam: null, currency: null, amount: null, budgetCode: null, contractor: 'BUILDCO',
  currentHolderSub: null, roundNo: 0, createdAt: '2026-07-01T00:00:00.000Z',
}

// The API returns a page {items, nextCursor}; null cursor = last page.
const page = (items: (typeof ROW)[], nextCursor: string | null = null) => ({ items, nextCursor })

describe('ClosedTickets (FR-17 lookup)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the try-fewer hint with the typed keyword on no match', async () => {
    vi.mocked(searchClosed).mockResolvedValue(page([]))
    render(<ClosedTickets />)
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Nhà thầu'), { target: { value: 'NOPE' } })
      fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    })
    await waitFor(() =>
      expect(screen.getByText(/Không thấy hồ sơ khớp "NOPE"/)).toBeInTheDocument(),
    )
    expect(searchClosed).toHaveBeenCalledWith(expect.objectContaining({ contractor: 'NOPE' }))
  })

  it('renders matched rows', async () => {
    vi.mocked(searchClosed).mockResolvedValue(page([ROW]))
    render(<ClosedTickets />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    })
    await waitFor(() => expect(screen.getByText('CT-2026-0001')).toBeInTheDocument())
    expect(screen.getByText('BUILDCO')).toBeInTheDocument()
  })

  it('DCC1 reopens a row (ConfirmModal reason → reopenClosed)', async () => {
    vi.mocked(searchClosed).mockResolvedValue(page([ROW]))
    vi.mocked(reopenClosed).mockResolvedValue({ status: 'Returned' })
    render(<ClosedTickets role="DCC1" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    })
    await waitFor(() => expect(screen.getByText('CT-2026-0001')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại…' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Sai số tiền' } })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Mở lại' }))
    })
    await waitFor(() => expect(reopenClosed).toHaveBeenCalledWith('t1', 'Sai số tiền'))
  })

  it('DCC3 may only propose a reopen on a closed Payment (→ requestReopen, Story 4.3 AC4)', async () => {
    const payment = { ...ROW, id: 'p1', code: 'CT-2026-0304', flow: 'Payment', status: 'Sent to Accounting' }
    vi.mocked(searchClosed).mockResolvedValue(page([payment]))
    vi.mocked(requestReopen).mockResolvedValue({ ok: true })
    render(<ClosedTickets role="DCC3" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    })
    await waitFor(() => expect(screen.getByText('CT-2026-0304')).toBeInTheDocument())
    // DCC3 never gets the direct "Mở lại" action — only the proposal.
    expect(screen.queryByRole('button', { name: /Mở lại/ })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Đề nghị mở lại' }))
    })
    await waitFor(() => expect(requestReopen).toHaveBeenCalledWith('p1'))
  })

  it('pages the archive with "Tải thêm" (appends the next keyset page)', async () => {
    const ROW2 = { ...ROW, id: 't2', code: 'CT-2026-0002' }
    vi.mocked(searchClosed)
      .mockResolvedValueOnce(page([ROW], 'CUR1')) // initial mount load → has more
      .mockResolvedValueOnce(page([ROW2], null)) // load-more → last page
    render(<ClosedTickets />)
    await waitFor(() => expect(screen.getByText('CT-2026-0001')).toBeInTheDocument())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tải thêm' }))
    })
    // Both pages now visible (appended, not replaced)…
    await waitFor(() => expect(screen.getByText('CT-2026-0002')).toBeInTheDocument())
    expect(screen.getByText('CT-2026-0001')).toBeInTheDocument()
    // …and load-more passed the previous page's cursor.
    expect(searchClosed).toHaveBeenLastCalledWith(expect.anything(), 'CUR1')
    // Last page (null cursor) → the button is gone.
    expect(screen.queryByRole('button', { name: 'Tải thêm' })).toBeNull()
  })
})

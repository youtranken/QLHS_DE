import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./api', () => ({
  confirmReturnReceipt: vi.fn(),
  resubmitTicket: vi.fn(),
  updateFields: vi.fn(),
  getOptions: vi.fn().mockResolvedValue([]),
  getDocumentTypes: vi.fn().mockResolvedValue([]),
}))
import { confirmReturnReceipt, resubmitTicket, updateFields, type TicketDetail } from './api'
import { ReturnPanel } from './ReturnPanel'

function detailAt(status: string): TicketDetail {
  return {
    id: 't1',
    code: 'G-2026-0001',
    status,
    flow: 'General',
    documentType: 'General',
    description: 'Duyệt chi phí',
    paymentTerm: 'N/A',
    contractNo: 'N/A',
    paymentNo: null,
    projectTeam: 'Team A',
    budgetCode: 'BUD',
    contractor: 'ACME',
    amount: '1000',
    currency: 'VND',
    roundNo: 0,
    requiresContractNo: false,
    allowSkip: false,
    overdueDays: 0,
    dwellDays: 1,
    isClosed: false,
    mine: false,
    actions: [],
    route: [],
    paused: false,
    pauseReason: null,
    pauses: [],
    timeline: [
      {
        action: 'sendBack',
        fromStatus: 'Submitted to VP Andy',
        toStatus: 'Returned',
        actorSub: 'dcc1-a',
        occurredAt: '2026-07-10T02:00:00.000Z',
        reason: 'Thiếu chữ ký',
        roundNo: 0,
      },
    ],
    directory: {},
  }
}

describe('ReturnPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('at Returned: shows the reason and confirms receipt', async () => {
    vi.mocked(confirmReturnReceipt).mockResolvedValue({ ok: true })
    render(<ReturnPanel detail={detailAt('Returned')} onDone={vi.fn()} />)
    expect(screen.getByText(/Thiếu chữ ký/)).toBeInTheDocument()
    expect(screen.queryByText('Nộp lại')).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /xác nhận đã nhận lại/i }))
    })
    expect(confirmReturnReceipt).toHaveBeenCalledWith('t1')
  })

  it('at Return-fixing: edits a field then resubmits (update → resubmit)', async () => {
    vi.mocked(updateFields).mockResolvedValue({ ok: true })
    vi.mocked(resubmitTicket).mockResolvedValue({ ok: true })
    render(<ReturnPanel detail={detailAt('Return-fixing')} onDone={vi.fn()} />)

    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('Duyệt chi phí'), {
        target: { value: 'Bổ sung chữ ký' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Nộp lại' }))
    })

    await waitFor(() => expect(resubmitTicket).toHaveBeenCalledWith('t1'))
    expect(updateFields).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ description: 'Bổ sung chữ ký', contractor: 'ACME' }),
    )
  })
})

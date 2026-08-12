import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('./api', () => ({ getTicketDetail: vi.fn() }))
import { getTicketDetail, type TicketDetail as Detail } from './api'
import { TicketDetail } from './TicketDetail'

const fixture: Detail = {
  id: 't1', code: 'CT-2026-0042', status: 'Received from ACC', flow: 'Contract', documentType: 'Contract',
  description: 'Thanh toán đợt 4/8', paymentTerm: 'Net 30', contractNo: 'HD-118', documentNo: null,
  projectTeam: 'Landmark 81', budgetCode: 'B-04', contractor: 'Coteccons',
  amount: '3480500000', currency: 'VND', roundNo: 0, overdueDays: 4, dwellDays: 4,
  isClosed: false,
  mine: false,
  actions: [],
  route: [
    { status: 'Submitted', phase: 'past', holder: 'An', enteredAt: '2026-06-28T09:20:00Z' },
    { status: 'Received from ACC', phase: 'now', holder: 'Trâm', enteredAt: '2026-07-03T16:12:00Z' },
    { status: 'Completed', phase: 'next', holder: null, enteredAt: null },
  ],
  paused: false,
  pauseReason: null,
  pauses: [],
  timeline: [
    { action: 'submit', fromStatus: '', toStatus: 'Submitted', actorSub: 'sub-an', occurredAt: '2026-06-28T09:20:00Z', reason: null, roundNo: 0 },
    { action: 'sendBack', fromStatus: 'x', toStatus: 'Returned', actorSub: 'sub-kt', occurredAt: '2026-07-01T10:00:00Z', reason: 'Thiếu biên bản', roundNo: 0 },
  ],
  directory: { 'sub-an': 'Nguyễn Thị An', 'sub-kt': 'Phòng Kế toán' },
}

describe('TicketDetail — read-only deep-link page', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders code, EN status, a field and an immutable-log line with its reason', async () => {
    vi.mocked(getTicketDetail).mockResolvedValue(fixture)
    render(<TicketDetail ticketId="t1" />)
    await waitFor(() => expect(screen.getByText('CT-2026-0042')).toBeInTheDocument())
    // EN status shows in the header chip (and the timeline "now" station).
    expect(screen.getAllByText('Received from ACC').length).toBeGreaterThan(0)
    expect(screen.getByText('HD-118')).toBeInTheDocument()
    // Immutable log keeps the Return reason verbatim + resolves the actor sub to
    // a directory name (never the raw sub).
    expect(screen.getByText(/Thiếu biên bản/)).toBeInTheDocument()
    expect(screen.getByText('Phòng Kế toán')).toBeInTheDocument()
    expect(screen.queryByText('sub-kt')).not.toBeInTheDocument()
    // Over-SLA badge is present.
    expect(screen.getByLabelText('Quá hạn 4 ngày')).toBeInTheDocument()
  })

  it('renders human labels for technical events, a highlighted return reason, and the system actor', async () => {
    vi.mocked(getTicketDetail).mockResolvedValue({
      ...fixture,
      timeline: [
        { action: 'field_changed', fromStatus: 'Submitted', toStatus: 'Submitted', actorSub: 'sub-an', occurredAt: '2026-06-29T09:00:00Z', reason: null, roundNo: 0 },
        { action: 'missing_paper_cleared', fromStatus: 'Submitted to DCC2', toStatus: 'Submitted to DCC2', actorSub: 'sub-kt', occurredAt: '2026-06-30T09:00:00Z', reason: null, roundNo: 0 },
        { action: 'reopen', fromStatus: 'Completed', toStatus: 'Reopened', actorSub: 'sub-kt', occurredAt: '2026-07-01T09:00:00Z', reason: null, roundNo: 0 },
        { action: 'auto_return', fromStatus: 'Submitted', toStatus: 'Return-fixing', actorSub: 'system', occurredAt: '2026-07-02T09:00:00Z', reason: 'Quá hạn tiếp nhận', roundNo: 0 },
      ],
    })
    render(<TicketDetail ticketId="t1" />)
    await waitFor(() => expect(screen.getByText('CT-2026-0042')).toBeInTheDocument())
    // Raw technical event keys must never leak to the reader.
    expect(screen.queryByText(/field_changed|missing_paper_cleared|auto_return/)).not.toBeInTheDocument()
    expect(screen.getByText('sửa dữ liệu hồ sơ')).toBeInTheDocument()
    expect(screen.getByText('đã bàn giao lại (đủ giấy)')).toBeInTheDocument()
    // Reopen marks a new round; the auto-return reason is highlighted; system actor named.
    expect(screen.getByText('Bắt đầu vòng mới')).toBeInTheDocument()
    expect(screen.getByText('Lý do trả lại:')).toBeInTheDocument()
    expect(screen.getByText(/Quá hạn tiếp nhận/)).toBeInTheDocument()
    expect(screen.getByText('Hệ thống')).toBeInTheDocument()
  })

  it('Contract flow: "Contract No" shows the DCC2 documentNo, not the Applicant placeholder', async () => {
    // fixture.contractNo = 'HD-118' (Applicant placeholder). DCC2 assigned 'CT-ACC-42'.
    vi.mocked(getTicketDetail).mockResolvedValue({ ...fixture, documentType: 'Contract', contractNo: 'HD-118', documentNo: 'CT-ACC-42' })
    render(<TicketDetail ticketId="t1" />)
    await waitFor(() => expect(screen.getByText('CT-ACC-42')).toBeInTheDocument())
    expect(screen.getByText('Contract No')).toBeInTheDocument()
    // The Applicant's placeholder is not shown as a second Contract-No field.
    expect(screen.queryByText('HD-118')).not.toBeInTheDocument()
    expect(screen.queryByText('Payment No')).not.toBeInTheDocument()
  })

  it('Contract flow: falls back to the Applicant contractNo until DCC assigns one', async () => {
    vi.mocked(getTicketDetail).mockResolvedValue({ ...fixture, documentType: 'Contract', contractNo: 'HD-118', documentNo: null })
    render(<TicketDetail ticketId="t1" />)
    await waitFor(() => expect(screen.getByText('HD-118')).toBeInTheDocument())
    expect(screen.getByText('Contract No')).toBeInTheDocument()
  })

  it('Payment flow: Applicant contractNo = "Contract No", DCC3 documentNo = "Payment No"', async () => {
    vi.mocked(getTicketDetail).mockResolvedValue({ ...fixture, flow: 'Payment', documentType: 'Payment', contractNo: 'HD-777', documentNo: 'PN-2026-9' })
    render(<TicketDetail ticketId="t1" />)
    await waitFor(() => expect(screen.getByText('PN-2026-9')).toBeInTheDocument())
    expect(screen.getByText('Payment No')).toBeInTheDocument()
    expect(screen.getByText('HD-777')).toBeInTheDocument() // Applicant's real contract no
    expect(screen.getByText('Contract No.')).toBeInTheDocument() // Applicant field keeps the period
  })

  it('Payment flow: no "Payment No" field until DCC3 enters it (documentNo null)', async () => {
    vi.mocked(getTicketDetail).mockResolvedValue({ ...fixture, flow: 'Payment', documentType: 'Payment', documentNo: null })
    render(<TicketDetail ticketId="t1" />)
    await waitFor(() => expect(screen.getByText('CT-2026-0042')).toBeInTheDocument())
    expect(screen.queryByText('Payment No')).not.toBeInTheDocument()
  })

  // A transient failure shows the error screen with Retry; clicking it must
  // recover and render the ticket (regression: load() didn't clear `error`).
  it('recovers on Retry after a transient load failure', async () => {
    vi.mocked(getTicketDetail).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(fixture)
    render(<TicketDetail ticketId="t1" />)
    const retry = await screen.findByRole('button', { name: /thử lại|retry/i })
    await userEvent.click(retry)
    await waitFor(() => expect(screen.getByText('CT-2026-0042')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /thử lại|retry/i })).not.toBeInTheDocument()
  })
})

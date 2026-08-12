import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

vi.mock('./api', () => ({
  getStationBoard: vi.fn(),
  actionCard: vi.fn(),
  confirmCard: vi.fn(),
  pickCard: vi.fn(),
  seizeCard: vi.fn(),
  undoCard: vi.fn(),
  receiveDcc2: vi.fn(),
  receiveDcc3: vi.fn(),
  receiveFromAcc: vi.fn(),
  missingPaperDcc2: vi.fn(),
  missingPaperDcc3: vi.fn(),
  resendDcc2: vi.fn(),
  resendDcc3: vi.fn(),
  sendAccounting: vi.fn(),
  sendAccountingDcc3: vi.fn(),
  completeContract: vi.fn(),
  returnPushback: vi.fn(),
}))
import {
  getStationBoard,
  actionCard,
  resendDcc2,
  resendDcc3,
  receiveDcc3,
  sendAccountingDcc3,
  type BoardColumn,
} from './api'
import { StationBoard } from './StationBoard'

const board: BoardColumn[] = [
  {
    status: 'Submitted to VP Andy',
    overSla: false,
    cards: [
      {
        id: 't1',
        code: 'G-2026-0001',
        contractor: 'ACME',
        amount: '1000',
        priority: 'normal',
        flow: 'General',
        status: 'Submitted to VP Andy',
        overdueDays: 0,
        lockedByMe: false,
        lockedBy: null,
        actions: [
          { event: 'sendBack', label: 'Trả lại (Return)', toStatus: 'Returned', reversible: false, reasonRequired: true },
        ],
      },
    ],
  },
]

describe('StationBoard — Return requires a reason (AC1)', () => {
  beforeEach(() => {
    vi.mocked(getStationBoard).mockResolvedValue(board)
    vi.mocked(actionCard).mockResolvedValue({ status: 'Returned' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('aborts the Return when no reason is given (confirm disabled, no API call)', async () => {
    render(<StationBoard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Trả lại (Return)' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Trả lại (Return)' })).toBeDisabled()
    expect(actionCard).not.toHaveBeenCalled()
  })

  it('sends the reason to the action endpoint when provided', async () => {
    render(<StationBoard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Trả lại (Return)' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Thiếu chữ ký' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Trả lại (Return)' }))
    await waitFor(() =>
      expect(actionCard).toHaveBeenCalledWith('t1', 'sendBack', 'Thiếu chữ ký'),
    )
  })
})

const dcc2Board: BoardColumn[] = [
  {
    status: 'Submitted to DCC2',
    overSla: false,
    cards: [
      {
        id: 't2',
        code: 'CT-2026-0001',
        contractor: 'ACME',
        amount: '5000000',
        priority: 'normal',
        flow: 'Contract',
        status: 'Submitted to DCC2',
        overdueDays: 0,
        lockedByMe: false,
        lockedBy: null,
        actions: [
          {
            event: 'confirmReceivedByDcc2',
            label: 'Kiểm tra bản cứng',
            toStatus: 'Received by DCC2',
            reversible: false,
            reasonRequired: false,
          },
        ],
      },
    ],
  },
]

describe('StationBoard — 2-phase handover (Story 3.1)', () => {
  beforeEach(() => vi.mocked(getStationBoard).mockResolvedValue(dcc2Board))
  afterEach(() => vi.restoreAllMocks())

  it('DCC2 "Kiểm tra bản cứng" opens the check modal (not a blind transition)', async () => {
    render(<StationBoard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Kiểm tra bản cứng' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(actionCard).not.toHaveBeenCalled()
  })
})

const reconcileBoard: BoardColumn[] = [
  {
    status: 'Submitted to DCC2',
    reconcile: true,
    label: 'Chờ đối chiếu (DCC2 báo thiếu giấy)',
    overSla: false,
    cards: [
      {
        id: 't3',
        code: 'CT-2026-0002',
        contractor: 'ACME',
        amount: '1',
        priority: 'normal',
        flow: 'Contract',
        status: 'Submitted to DCC2',
        overdueDays: 0,
        lockedByMe: false,
        lockedBy: null,
        actions: [
          {
            event: '__resend',
            label: 'Đã bổ sung, bàn giao lại →',
            toStatus: 'Submitted to DCC2',
            reversible: false,
            reasonRequired: false,
          },
        ],
      },
    ],
  },
]

const choAccBoard: BoardColumn[] = [
  {
    status: 'Submitted to Accounting',
    label: 'Chờ ACC',
    overSla: false,
    cards: [
      {
        id: 't4',
        code: 'CT-2026-0009',
        contractor: 'ACME',
        amount: '1',
        priority: 'normal',
        flow: 'Contract',
        status: 'Submitted to Accounting',
        overdueDays: 0,
        lockedByMe: false,
        lockedBy: null,
        actions: [
          {
            event: 'receiveFromAcc',
            label: 'Nhận về từ ACC',
            toStatus: 'Received from ACC',
            reversible: false,
            reasonRequired: false,
          },
        ],
      },
    ],
  },
]

describe('StationBoard — DCC1 Chờ ACC (Story 3.3)', () => {
  beforeEach(() => vi.mocked(getStationBoard).mockResolvedValue(choAccBoard))
  afterEach(() => vi.restoreAllMocks())

  it('renders the "Chờ ACC" label and opens the dated receipt modal', async () => {
    render(<StationBoard />)
    expect(await screen.findByText('Chờ ACC')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Nhận về từ ACC' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Nhận về từ ACC')
  })
})

describe('StationBoard — DCC1 reconcile lane (Story 3.1 AC4)', () => {
  beforeEach(() => vi.mocked(getStationBoard).mockResolvedValue(reconcileBoard))
  afterEach(() => vi.restoreAllMocks())

  it('re-hand over routes to the resend endpoint', async () => {
    vi.mocked(resendDcc2).mockResolvedValue({ ok: true })
    render(<StationBoard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Đã bổ sung, bàn giao lại →' }))
    await waitFor(() => expect(resendDcc2).toHaveBeenCalledWith('t3'))
  })
})

const dcc3Board: BoardColumn[] = [
  {
    status: 'Submitted to DCC3',
    overSla: false,
    cards: [
      {
        id: 'p1',
        code: 'CT-2026-0100',
        contractor: 'ACME',
        amount: '3000000',
        priority: 'normal',
        flow: 'Payment',
        status: 'Submitted to DCC3',
        overdueDays: 0,
        lockedByMe: false,
        lockedBy: null,
        actions: [
          {
            event: 'confirmReceivedByDcc3',
            label: 'Kiểm tra bản cứng',
            toStatus: 'Received by DCC3',
            reversible: false,
            reasonRequired: false,
          },
        ],
      },
    ],
  },
]

describe('StationBoard — Payment 2-phase handover DCC3 (Story 4.1)', () => {
  beforeEach(() => vi.mocked(getStationBoard).mockResolvedValue(dcc3Board))
  afterEach(() => vi.restoreAllMocks())

  it('DCC3 "Kiểm tra bản cứng" opens the modal, and confirm hits the DCC3 endpoint', async () => {
    vi.mocked(receiveDcc3).mockResolvedValue({ status: 'Received by DCC3' })
    render(<StationBoard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Kiểm tra bản cứng' }))
    const dialog = await screen.findByRole('dialog')
    expect(actionCard).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(receiveDcc3).toHaveBeenCalledWith('p1', expect.any(String)))
  })
})

const reconcileDcc3Board: BoardColumn[] = [
  {
    status: 'Submitted to DCC3',
    reconcile: true,
    label: 'Chờ đối chiếu (DCC2/DCC3 báo thiếu giấy / đẩy ngược)',
    overSla: false,
    cards: [
      {
        id: 'p2',
        code: 'CT-2026-0101',
        contractor: 'ACME',
        amount: '1',
        priority: 'normal',
        flow: 'Payment',
        status: 'Submitted to DCC3',
        overdueDays: 0,
        lockedByMe: false,
        lockedBy: null,
        actions: [
          {
            event: '__resend-dcc3',
            label: 'Đã bổ sung, bàn giao lại →',
            toStatus: 'Submitted to DCC3',
            reversible: false,
            reasonRequired: false,
          },
        ],
      },
    ],
  },
]

const dcc3SendBoard: BoardColumn[] = [
  {
    status: 'Received by DCC3',
    overSla: false,
    cards: [
      {
        id: 'p3',
        code: 'CT-2026-0102',
        contractor: 'ACME',
        amount: '3000000',
        priority: 'normal',
        flow: 'Payment',
        status: 'Received by DCC3',
        overdueDays: 0,
        lockedByMe: false,
        lockedBy: null,
        actions: [
          {
            event: 'sendToAccounting',
            label: 'Nhập Payment number & gửi ACC',
            toStatus: 'Sent to Accounting',
            reversible: false,
            reasonRequired: false,
          },
        ],
      },
    ],
  },
]

describe('StationBoard — Payment send ACC closes at Sent to Accounting (Story 4.2)', () => {
  beforeEach(() => vi.mocked(getStationBoard).mockResolvedValue(dcc3SendBoard))
  afterEach(() => vi.restoreAllMocks())

  it('opens the Document No modal (with H5 note) and routes to the DCC3 endpoint', async () => {
    vi.mocked(sendAccountingDcc3).mockResolvedValue({ status: 'Sent to Accounting' })
    render(<StationBoard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi Kế toán…' }))
    const dialog = await screen.findByRole('dialog')
    // Payment (DCC3) field is labelled "Payment No"; the old warning text is gone.
    expect(dialog).toHaveTextContent('Payment No')
    expect(dialog).not.toHaveTextContent('không email Applicant')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '26-CC-9-CT' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi ACC' }))
    // Payment is irreversible → a danger confirm gate appears before the POST.
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi ACC & đóng hồ sơ' }))
    await waitFor(() => expect(sendAccountingDcc3).toHaveBeenCalledWith('p3', '26-CC-9-CT'))
  })
})

const twoCardBoard: BoardColumn[] = [
  {
    status: 'Submitted to VP Andy',
    overSla: false,
    cards: [
      { id: 'a1', code: 'G-2026-0001', contractor: 'ACME', amount: '1', priority: 'normal', flow: 'General', status: 'Submitted to VP Andy', overdueDays: 0, lockedByMe: false, lockedBy: null, actions: [] },
      { id: 'a2', code: 'G-2026-0002', contractor: 'ZENITH', amount: '1', priority: 'normal', flow: 'General', status: 'Submitted to VP Andy', overdueDays: 0, lockedByMe: false, lockedBy: null, actions: [] },
    ],
  },
]

describe('StationBoard — filter reflects the count & empty state (UX H1)', () => {
  beforeEach(() => vi.mocked(getStationBoard).mockResolvedValue(twoCardBoard))
  afterEach(() => vi.restoreAllMocks())

  it('shows a matched/total count and hides non-matching cards when filtering', async () => {
    render(<StationBoard />)
    await screen.findByText('G-2026-0001')
    fireEvent.change(screen.getByLabelText('Tìm hồ sơ trong bảng'), { target: { value: 'ACME' } })
    expect(await screen.findByText('1/2')).toBeInTheDocument() // not the unfiltered "2"
    expect(screen.queryByText('G-2026-0002')).not.toBeInTheDocument()
  })

  it('shows a board-level no-match notice when nothing matches (not a silent blank)', async () => {
    render(<StationBoard />)
    await screen.findByText('G-2026-0001')
    fireEvent.change(screen.getByLabelText('Tìm hồ sơ trong bảng'), { target: { value: 'zzz-nope' } })
    expect(await screen.findByText(/Không có hồ sơ nào khớp bộ lọc/)).toBeInTheDocument()
  })
})

describe('StationBoard — Payment reconcile lane resend (Story 4.1)', () => {
  beforeEach(() => vi.mocked(getStationBoard).mockResolvedValue(reconcileDcc3Board))
  afterEach(() => vi.restoreAllMocks())

  it('re-hand over routes to the DCC3 resend endpoint', async () => {
    vi.mocked(resendDcc3).mockResolvedValue({ ok: true })
    render(<StationBoard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Đã bổ sung, bàn giao lại →' }))
    await waitFor(() => expect(resendDcc3).toHaveBeenCalledWith('p2'))
  })
})

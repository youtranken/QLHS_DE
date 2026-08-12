import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./api', () => ({
  getDispatchMap: vi.fn(),
  getStationTickets: vi.fn(),
}))
import { getDispatchMap, getStationTickets, type FlowLine, type StationTicket } from './api'
import { LineMap } from './LineMap'

const LINES: FlowLine[] = [
  {
    flow: 'General',
    total: 5,
    stations: [
      { status: 'Submitted', count: 2, overdueCount: 0, overSla: false },
      { status: 'Submitted to VP Andy', count: 3, overdueCount: 1, overSla: true },
      { status: 'Completed', count: 0, overdueCount: 0, overSla: false },
    ],
  },
  {
    flow: 'Contract',
    total: 2,
    stations: [{ status: 'Submitted to DCC2', count: 2, overdueCount: 0, overSla: false }],
  },
]

const TICKETS: StationTicket[] = [
  { id: 't1', code: 'GEN-2026-00312', contractor: 'Cty TNHH XD Hòa Bình', flow: 'General', overdueDays: 2 },
]

describe('LineMap — bản đồ tuyến metro v3', () => {
  beforeEach(() => {
    vi.mocked(getDispatchMap).mockResolvedValue(LINES)
    vi.mocked(getStationTickets).mockResolvedValue(TICKETS)
  })
  afterEach(() => vi.restoreAllMocks())

  it('vẽ mỗi luồng một ray, tên ga ngắn, cờ ▲ khi quá SLA', async () => {
    render(<LineMap />)
    await waitFor(() => expect(screen.getAllByText('General').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Contract').length).toBeGreaterThan(0)
    // tên ga rút gọn (bỏ tiền tố "Submitted to")
    expect(screen.getByText('VP Andy')).toBeInTheDocument()
    expect(screen.getByText('DCC2')).toBeInTheDocument()
    // cờ/nhãn quá hạn xuất hiện ở ga over-SLA
    expect(screen.getAllByText(/quá hạn/).length).toBeGreaterThan(0)
  })

  it('gộp chỉ số Đang chạy/Quá SLA vào header bản đồ (không thêm hàng riêng)', async () => {
    render(<LineMap />)
    await waitFor(() => expect(screen.getByText('đang chạy')).toBeInTheDocument())
    // running = tổng mỗi tuyến = 5 + 2
    expect(screen.getByText('7')).toBeInTheDocument()
    // General/VP Andy quá hạn → chip "quá SLA" tô đỏ ("quá SLA" cũng ở legend nên
    // lọc theo .mapstat để không dính nhãn chú giải).
    expect(screen.getByText('quá SLA', { selector: '.mapstat' })).toHaveClass('hot')
  })

  it('click một ga mở drawer chi tiết với hồ sơ ở ga', async () => {
    render(<LineMap />)
    await waitFor(() => expect(screen.getByText('VP Andy')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Trạm Submitted to VP Andy/ }))
    await waitFor(() => expect(screen.getByText('GEN-2026-00312')).toBeInTheDocument())
    expect(getStationTickets).toHaveBeenCalledWith('Submitted to VP Andy', 'General')
  })
})

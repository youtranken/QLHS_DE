import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { getSlaConfig, updateSla, type SlaConfigRow } from './api'
import { SlaConfigAdmin } from './SlaConfigAdmin'

vi.mock('./api', () => ({
  getSlaConfig: vi.fn(),
  updateSla: vi.fn(),
}))

const ROWS: SlaConfigRow[] = [
  { status: 'Submitted to BOP', flow: 'Contract', slaDays: 7, updatedBySub: null, updatedAt: '2026-07-01T00:00:00.000Z' },
  { status: 'Received by DCC3', flow: 'Payment', slaDays: 2, updatedBySub: null, updatedAt: '2026-07-01T00:00:00.000Z' },
]

describe('SlaConfigAdmin (Story 5.1) — stepper theo luồng + lưu batch', () => {
  beforeEach(() => {
    vi.mocked(getSlaConfig).mockResolvedValue(ROWS)
    vi.mocked(updateSla).mockResolvedValue({ ok: true })
  })
  afterEach(() => vi.restoreAllMocks())

  it('hiện các ngưỡng đã seed, gom theo luồng', async () => {
    render(<SlaConfigAdmin />)
    await waitFor(() => expect(screen.getByText('Submitted to BOP')).toBeInTheDocument())
    expect(screen.getByLabelText('Ngưỡng SLA Payment Received by DCC3 (ngày)')).toHaveValue(2)
  })

  it('sửa ngưỡng rồi lưu → updateSla(flow, status, days)', async () => {
    render(<SlaConfigAdmin />)
    const input = await screen.findByLabelText('Ngưỡng SLA Contract Submitted to BOP (ngày)')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ngưỡng SLA' }))
    await waitFor(() =>
      expect(updateSla).toHaveBeenCalledWith('Contract', 'Submitted to BOP', 9),
    )
  })

  it('Hủy hoàn tác thay đổi, không gọi API', async () => {
    render(<SlaConfigAdmin />)
    const input = await screen.findByLabelText('Ngưỡng SLA Contract Submitted to BOP (ngày)')
    fireEvent.change(input, { target: { value: '9' } })
    expect(screen.getByText(/thay đổi chưa lưu/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Ngưỡng SLA Contract Submitted to BOP (ngày)')).toHaveValue(7),
    )
    expect(updateSla).not.toHaveBeenCalled()
  })
})

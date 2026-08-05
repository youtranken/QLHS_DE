import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AdminPauses } from './AdminPauses'
import * as api from './api'
import type { SlaPauseReport } from './api'

const get = vi.spyOn(api, 'getSlaPauses')

function report(over: Partial<SlaPauseReport> = {}): SlaPauseReport {
  return {
    open: [
      {
        ticketId: 't1',
        code: 'PMH-A-2026-0001',
        status: 'SubmittedToDcc2',
        flow: 'General',
        reason: 'Chờ nhà thầu bổ sung bản gốc',
        pausedBySub: 'dcc2-hoa',
        pausedByName: 'Chị Hoa',
        pausedAt: '2026-07-20T02:00:00.000Z',
        pausedDays: 5,
        stale: true,
      },
    ],
    byStation: [
      { status: 'SubmittedToDcc2', pauses: 3, tickets: 2, openNow: 1, longestDays: 5 },
    ],
    windowDays: 30,
    staleAfterDays: 5,
    ...over,
  }
}

// No mockReset/mockClear between tests: every test sets its own return value,
// and resetting the spy makes the rejected-path test escape as an unhandled
// rejection instead of reaching the component's own .catch.

describe('AdminPauses', () => {
  it('names the ticket, the reason and who stopped the clock', async () => {
    get.mockResolvedValue(report())
    render(<AdminPauses />)
    expect(await screen.findByText('PMH-A-2026-0001')).toBeInTheDocument()
    expect(screen.getByText('Chờ nhà thầu bổ sung bản gốc')).toBeInTheDocument()
    expect(screen.getByText(/Chị Hoa/)).toBeInTheDocument()
  })

  it('marks a pause that has run too long — the point of the page', async () => {
    get.mockResolvedValue(report())
    const { container } = render(<AdminPauses />)
    await waitFor(() => expect(container.querySelector('.pzrow.stale')).toBeInTheDocument())
    // "quá lâu" appears twice on purpose: the section count and the row itself.
    expect(screen.getAllByText(/quá lâu/).length).toBeGreaterThan(0)
  })

  it('does not cry wolf over a young pause', async () => {
    get.mockResolvedValue(
      report({ open: [{ ...report().open[0]!, pausedDays: 1, stale: false }] }),
    )
    const { container } = render(<AdminPauses />)
    await waitFor(() => expect(screen.getByText('PMH-A-2026-0001')).toBeInTheDocument())
    expect(container.querySelector('.pzrow.stale')).toBeNull()
  })

  it('shows how often each station leans on pause', async () => {
    get.mockResolvedValue(report())
    render(<AdminPauses />)
    expect(await screen.findByText(/3 lần · 2 hồ sơ/)).toBeInTheDocument()
  })

  it('says so plainly when no clock is stopped', async () => {
    get.mockResolvedValue(report({ open: [], byStation: [] }))
    render(<AdminPauses />)
    expect(await screen.findByText(/Không có đồng hồ nào đang dừng/)).toBeInTheDocument()
  })

  it('reports a failure instead of an empty page', async () => {
    get.mockRejectedValue(new Error('offline'))
    render(<AdminPauses />)
    expect(await screen.findByText(/Không tải được báo cáo/)).toBeInTheDocument()
  })
})

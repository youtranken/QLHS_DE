import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminAnalytics } from './AdminAnalytics'
import * as api from './api'
import type { AnalyticsData } from './api'

vi.mock('../../shared/route', () => ({ openTicketDetail: vi.fn() }))
import { openTicketDetail } from '../../shared/route'

const get = vi.spyOn(api, 'getAnalytics')

function data(over: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
    granularity: 'month',
    flows: ['General', 'Contract', 'Payment'],
    throughput: [{ period: '2026-07', created: 5, completed: 3 }],
    returns: [
      { flow: 'General', tickets: 4, returns: 1, ratePct: 25 },
      { flow: 'Contract', tickets: 2, returns: 0, ratePct: 0 },
      { flow: 'Payment', tickets: 0, returns: 0, ratePct: 0 },
    ],
    dwell: [
      {
        status: 'Submitted',
        avgDays: 2,
        count: 3,
        cells: [
          { flow: 'General', count: 3, avgDays: 2 },
          { flow: 'Contract', count: 0, avgDays: 0 },
          { flow: 'Payment', count: 0, avgDays: 0 },
        ],
      },
    ],
    topOverdue: [
      { id: 't1', code: 'PMH-A-2026-0003', flow: 'General', status: 'Submitted', overdueDays: 12, holderSub: null },
    ],
    ...over,
  }
}

describe('AdminAnalytics', () => {
  it('renders throughput, return rate, dwell heatmap and top overdue', async () => {
    get.mockResolvedValue(data())
    render(<AdminAnalytics />)
    expect(await screen.findByText('PMH-A-2026-0003')).toBeInTheDocument()
    expect(screen.getByText('▲ 12 ngày')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    // Heatmap keeps the canonical EN station name (AD-13).
    expect(screen.getByRole('rowheader', { name: 'Submitted' })).toBeInTheDocument()
  })

  it('refetches with a new granularity when the toggle changes', async () => {
    get.mockResolvedValue(data())
    render(<AdminAnalytics />)
    await screen.findByText('PMH-A-2026-0003')
    await userEvent.click(screen.getByRole('button', { name: 'Tuần' }))
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('week'))
  })

  it('deep-links to the ticket when a top-overdue row is clicked', async () => {
    get.mockResolvedValue(data())
    render(<AdminAnalytics />)
    await userEvent.click(await screen.findByText('PMH-A-2026-0003'))
    expect(openTicketDetail).toHaveBeenCalledWith('PMH-A-2026-0003')
  })

  it('reports a failure instead of an empty page', async () => {
    get.mockRejectedValue(new Error('offline'))
    render(<AdminAnalytics />)
    expect(await screen.findByText(/Không tải được số liệu/)).toBeInTheDocument()
  })
})

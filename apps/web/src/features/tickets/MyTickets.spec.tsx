import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('./api', () => ({
  listMyTickets: vi.fn(),
  getTicketDetail: vi.fn(),
  cancelTicket: vi.fn(),
}))
vi.mock('./ReturnPanel', () => ({ ReturnPanel: () => <div>RETURN_PANEL</div> }))
import { listMyTickets, type TicketView } from './api'
import { MyTickets } from './MyTickets'

function row(over: Partial<TicketView>): TicketView {
  return {
    id: 't1', code: 'G-2026-0001', status: 'Submitted to VP Andy', flow: 'General',
    priority: 'normal', documentType: 'General', description: null, contractNo: null,
    projectTeam: null, paymentTerm: null, budgetCode: null,
    contractor: 'ACME', amount: '1000', currency: 'VND', currentHolderSub: null,
    roundNo: 0, createdAt: '2026-07-01T00:00:00.000Z', ...over,
  }
}

describe('MyTickets — unseen >24h signal (Story 5.3, UX-DR14)', () => {
  afterEach(() => vi.restoreAllMocks())
  beforeEach(() => {
    vi.mocked(listMyTickets).mockResolvedValue([
      row({ id: 'a', code: 'G-2026-0001', contractor: 'STALE', unseen: true }),
      row({ id: 'b', code: 'G-2026-0002', contractor: 'FRESH', unseen: false }),
    ])
  })

  it('marks only the unseen row with an accessible "chưa xem" indicator (not red)', async () => {
    render(<MyTickets reloadKey={0} />)
    await waitFor(() => expect(screen.getByText('G-2026-0001')).toBeInTheDocument())
    // Exactly one row carries the unseen dot; the seen row has none.
    const dots = screen.getAllByLabelText('Chưa xem trong hơn 24 giờ')
    expect(dots).toHaveLength(1)
  })
})

describe('MyTickets — live refresh (2.1: refetch on an SSE ticket change)', () => {
  beforeEach(() => vi.mocked(listMyTickets).mockResolvedValue([]))
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads once, then refetches when the ticket stream signals a change', async () => {
    // Minimal EventSource stand-in that lets the test push a 'ticket' event.
    let handler: (() => void) | undefined
    class FakeES {
      addEventListener(type: string, cb: () => void) {
        if (type === 'ticket') handler = cb
      }
      onmessage: (() => void) | null = null
      close() {}
    }
    vi.stubGlobal('EventSource', FakeES as unknown as typeof EventSource)
    vi.useFakeTimers()

    render(<MyTickets reloadKey={0} />)
    await vi.advanceTimersByTimeAsync(0) // flush initial load
    expect(vi.mocked(listMyTickets)).toHaveBeenCalledTimes(1)

    handler?.() // server says a ticket changed
    await vi.advanceTimersByTimeAsync(300) // debounce window
    expect(vi.mocked(listMyTickets)).toHaveBeenCalledTimes(2)
  })

  it('still catches up via the slow fallback poll if the stream is silent', async () => {
    vi.stubGlobal('EventSource', undefined) // no push available
    vi.useFakeTimers()
    render(<MyTickets reloadKey={0} />)
    await vi.advanceTimersByTimeAsync(0)
    const afterLoad = vi.mocked(listMyTickets).mock.calls.length

    await vi.advanceTimersByTimeAsync(30_000)
    expect(vi.mocked(listMyTickets).mock.calls.length).toBe(afterLoad + 1)
  })
})

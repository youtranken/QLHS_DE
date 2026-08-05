import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('./api', () => ({
  getNotifications: vi.fn(),
  markAllRead: vi.fn(),
  markOneRead: vi.fn(),
}))
vi.mock('../../shared/ticketStream', () => ({ subscribeTicketChanges: vi.fn(() => () => {}) }))
vi.mock('../../shared/route', () => ({ openTicketDetail: vi.fn() }))

import { getNotifications, markAllRead, markOneRead, type NotificationList } from './api'
import { openTicketDetail } from '../../shared/route'
import { NotificationBell } from './NotificationBell'

const list = (over: Partial<NotificationList> = {}): NotificationList => ({
  unread: 1,
  items: [
    { id: '5', ticketId: 't5', code: 'PMH-A-2026-0001', kind: 'Returned', createdAt: new Date().toISOString(), read: false },
    { id: '4', ticketId: 't4', code: 'PMH-B-2026-0002', kind: 'Submitted to DCC2', createdAt: new Date().toISOString(), read: true },
  ],
  ...over,
})

beforeEach(() => {
  vi.mocked(getNotifications).mockResolvedValue(list())
  vi.mocked(markAllRead).mockResolvedValue({ ok: true })
  vi.mocked(markOneRead).mockResolvedValue({ ok: true })
})

describe('NotificationBell', () => {
  it('shows the unread count on the bell', async () => {
    render(<NotificationBell />)
    expect(await screen.findByLabelText(/1 chưa đọc/)).toBeInTheDocument()
  })

  it('lists items with a human message when opened', async () => {
    render(<NotificationBell />)
    await screen.findByLabelText(/1 chưa đọc/)
    await userEvent.click(screen.getByRole('button', { name: /chưa đọc/ }))
    expect(screen.getByText('Hồ sơ bị trả lại — cần bổ sung')).toBeInTheDocument()
    expect(screen.getByText('Hồ sơ được bàn giao cho DCC2')).toBeInTheDocument()
  })

  it('opens the ticket and marks the item read on click', async () => {
    render(<NotificationBell />)
    await screen.findByLabelText(/1 chưa đọc/)
    await userEvent.click(screen.getByRole('button', { name: /chưa đọc/ }))
    await userEvent.click(screen.getByText('Hồ sơ bị trả lại — cần bổ sung'))

    expect(markOneRead).toHaveBeenCalledWith('5')
    expect(openTicketDetail).toHaveBeenCalledWith('PMH-A-2026-0001')
  })

  it('marks everything read and clears the badge', async () => {
    render(<NotificationBell />)
    await screen.findByLabelText(/1 chưa đọc/)
    await userEvent.click(screen.getByRole('button', { name: /1 chưa đọc/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))

    expect(markAllRead).toHaveBeenCalledOnce()
    // Badge gone: the bell no longer advertises unread items.
    await waitFor(() => expect(screen.queryByLabelText(/chưa đọc/)).not.toBeInTheDocument())
  })

  it('closes on Escape and returns focus to the bell', async () => {
    render(<NotificationBell />)
    const bell = await screen.findByRole('button', { name: /1 chưa đọc/ })
    await userEvent.click(bell)
    expect(screen.getByText('Hồ sơ bị trả lại — cần bổ sung')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByText('Hồ sơ bị trả lại — cần bổ sung')).not.toBeInTheDocument(),
    )
    expect(bell).toHaveFocus()
  })

  it('shows an empty state when there is nothing', async () => {
    vi.mocked(getNotifications).mockResolvedValue({ items: [], unread: 0 })
    render(<NotificationBell />)
    await waitFor(() => expect(screen.getByLabelText('Thông báo')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
    expect(screen.getByText('Chưa có thông báo.')).toBeInTheDocument()
  })
})

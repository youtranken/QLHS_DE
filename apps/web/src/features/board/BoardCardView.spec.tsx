import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardCardView } from './BoardCardView'
import type { BoardCard } from './api'

const card = (over: Partial<BoardCard> = {}): BoardCard => ({
  id: 't1',
  code: 'PMH-A-2026-0001',
  contractor: 'Công ty ABC',
  amount: '1000',
  priority: 'normal',
  flow: 'General',
  status: 'Submitted to VP Andy',
  overdueDays: 0,
  lockedByMe: false,
  lockedBy: null,
  actions: [],
  mine: true,
  paused: false,
  ...over,
})

function show(c: BoardCard) {
  const onAction = vi.fn()
  render(<BoardCardView card={c} onAction={onAction} onSeize={vi.fn()} />)
  return onAction
}

describe('BoardCardView — F8 paused state', () => {
  it('keeps a breach visible after the clock stops — pause must not erase red', () => {
    // The server already subtracts paused time, so 4 days over means it was
    // ALREADY late when someone hit pause. Hiding that would make pausing the
    // way to clean up a card.
    show(card({ paused: true, overdueDays: 4 }))
    expect(screen.getByText(/chờ bổ sung/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Đã quá hạn 4 ngày trước khi dừng/)).toBeInTheDocument()
  })

  it('shows only the pause pill when the ticket was still inside SLA', () => {
    show(card({ paused: true, overdueDays: 0 }))
    expect(screen.getByText(/chờ bổ sung/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/quá hạn/i)).not.toBeInTheDocument()
  })

  it('still shows the overdue badge when the ticket is genuinely late', () => {
    show(card({ overdueDays: 4 }))
    expect(screen.getByLabelText(/Quá hạn 4 ngày/)).toBeInTheDocument()
  })

  it('offers the clock control in the ⋯ menu and hands it to the caller', async () => {
    const onAction = show(card())
    await userEvent.click(screen.getByLabelText('Hành động'))
    const btn = screen.getByRole('button', { name: /Chờ bổ sung \(dừng SLA\)/i })
    await userEvent.click(btn)
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), expect.objectContaining({ reasonRequired: true }))
  })

  it('hides the clock control on a ticket held by someone else', () => {
    // Non-holder + no other actions → the ⋯ menu isn't even rendered, so the
    // pause control can't appear anywhere.
    show(card({ mine: false }))
    expect(screen.queryByRole('button', { name: /dừng SLA/i })).not.toBeInTheDocument()
  })
})

describe('BoardCardView — priority is display-only (DCC cannot change it)', () => {
  it('shows the priority chip but offers no change control in the ⋯ menu', async () => {
    render(<BoardCardView card={card({ priority: 'rush' })} onAction={vi.fn()} onSeize={vi.fn()} />)
    expect(screen.getByText(/^GẤP$/)).toBeInTheDocument()
    expect(screen.queryByText(/Đổi ưu tiên/i)).not.toBeInTheDocument()
  })

  it('shows a legacy "urgent" ticket as GẤP (Khẩn retired, nothing disappears)', async () => {
    render(<BoardCardView card={card({ priority: 'urgent' })} onAction={vi.fn()} onSeize={vi.fn()} />)
    expect(screen.getByText(/^GẤP$/)).toBeInTheDocument()
    expect(screen.queryByText(/KHẨN/)).not.toBeInTheDocument()
  })
})

describe('BoardCardView — FR-8 bulk select', () => {
  it('shows a checkbox when selectable and reports toggles', async () => {
    const onToggleSelect = vi.fn()
    render(
      <BoardCardView card={card()} onAction={vi.fn()} onSeize={vi.fn()} selectable onToggleSelect={onToggleSelect} />,
    )
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleSelect).toHaveBeenCalledWith('t1')
  })

  it('has no checkbox by default', () => {
    render(<BoardCardView card={card()} onAction={vi.fn()} onSeize={vi.fn()} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

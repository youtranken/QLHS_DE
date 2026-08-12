import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HandoverLog } from './HandoverLog'
import { mergeLog } from './detailLog'
import type { TimelineEntry } from './api'

const ev = (action: string, at: string, roundNo: number, reason: string | null = null): TimelineEntry => ({
  action, fromStatus: '', toStatus: '', actorSub: 'sub-a', occurredAt: at, reason, roundNo,
})
const log = (entries: TimelineEntry[]) => mergeLog(entries, [])
const dir = { 'sub-a': 'An' }

describe('HandoverLog — group older rounds behind a toggle', () => {
  it('single round (round 0) renders flat with no round toggle', () => {
    render(<HandoverLog log={log([ev('submit', '2026-07-01T09:00:00Z', 0), ev('confirm', '2026-07-01T10:00:00Z', 0)])} directory={dir} />)
    expect(screen.queryByRole('button', { name: /Round/ })).toBeNull()
    // Both entries are visible.
    expect(screen.getAllByText('An').length).toBe(2)
  })

  it('with a later round, round 0 collapses behind a "Round 0" toggle; latest stays open', () => {
    const rows = log([
      ev('submit', '2026-07-01T09:00:00Z', 0),
      ev('sendBack', '2026-07-02T09:00:00Z', 0, 'Thiếu giấy'),
      ev('resubmit', '2026-07-03T09:00:00Z', 1),
    ])
    render(<HandoverLog log={rows} directory={dir} />)

    // Latest round (1) is open → its reason-less entry shows; the round-0 reason is hidden until expanded.
    const toggle = screen.getByRole('button', { name: 'Round 0' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Thiếu giấy')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Thiếu giấy')).toBeInTheDocument()
  })
})

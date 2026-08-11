import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../shared/route', () => ({ openTicketDetail: vi.fn() }))
import { openTicketDetail } from '../../shared/route'
import { BoardCardView } from './BoardCardView'
import type { BoardCard } from './api'

const base: BoardCard = {
  id: 't1', code: 'CT-2026-0002', contractor: 'ACME', amount: '3000000',
  priority: 'normal', flow: 'Contract', status: 'Submitted to DCC2',
  overdueDays: 0, lockedByMe: false, lockedBy: null, actions: [],
}

function renderCard(over: Partial<BoardCard> = {}, onAction = vi.fn()) {
  render(<BoardCardView card={{ ...base, ...over }} onAction={onAction} onSeize={vi.fn()} />)
  return { onAction }
}

describe('BoardCardView — reconcile comment', () => {
  it('prints the DCC2/DCC3 reason on the card when present (reconcile lane)', () => {
    renderCard({ reconcileComment: 'Thiếu trang 3' })
    expect(screen.getByText(/Thiếu trang 3/)).toBeInTheDocument()
  })

  it('shows nothing extra when there is no reconcile comment', () => {
    renderCard({ reconcileComment: null })
    expect(screen.queryByText(/Thiếu trang/)).not.toBeInTheDocument()
  })
})

describe('BoardCardView — whole-card opens detail', () => {
  it('clicking the card body opens the detail', () => {
    renderCard()
    fireEvent.click(screen.getByText('ACME')) // the contractor line (.who)
    expect(openTicketDetail).toHaveBeenCalledWith('t1')
  })

  it('clicking an action button does NOT open the detail (button handles it)', () => {
    vi.mocked(openTicketDetail).mockClear()
    const { onAction } = renderCard({
      actions: [{ event: '__pick', label: 'Nhận', toStatus: 'Submitted to VP Andy', reversible: false, reasonRequired: false }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nhận' }))
    expect(openTicketDetail).not.toHaveBeenCalled()
    expect(onAction).toHaveBeenCalled()
  })
})

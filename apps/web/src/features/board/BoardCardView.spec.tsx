import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BoardCardView } from './BoardCardView'
import type { BoardCard } from './api'

const base: BoardCard = {
  id: 't1', code: 'CT-2026-0002', contractor: 'ACME', amount: '3000000',
  priority: 'normal', flow: 'Contract', status: 'Submitted to DCC2',
  overdueDays: 0, lockedByMe: false, lockedBy: null, actions: [],
}

function renderCard(over: Partial<BoardCard> = {}) {
  render(<BoardCardView card={{ ...base, ...over }} onAction={vi.fn()} onSeize={vi.fn()} />)
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

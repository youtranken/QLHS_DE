import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DupBadge } from './DupBadge'
import type { DupHint } from './api'

const hint = (over: Partial<DupHint> = {}): DupHint => ({
  id: 'dup-1',
  code: 'PMH-B-2026-0791',
  status: 'Submitted',
  flow: 'Contract-Budget',
  tier: 'strong',
  contractor: 'Công ty ABC',
  amount: '500000000',
  currency: 'VND',
  ageDays: 3,
  ...over,
})

describe('DupBadge', () => {
  it('renders nothing when there is no suspicion — a clean card stays clean', () => {
    const { container } = render(<DupBadge hints={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('warns with the number of suspected duplicates', () => {
    render(<DupBadge hints={[hint(), hint({ id: 'dup-2', code: 'PMH-B-0002' })]} />)
    expect(screen.getByRole('button', { name: /2 hồ sơ nghi trùng/i })).toBeInTheDocument()
  })

  it('lists each suspected ticket with what DCC1 needs to compare', () => {
    render(<DupBadge hints={[hint()]} />)
    expect(screen.getByText('PMH-B-2026-0791')).toBeInTheDocument()
    expect(screen.getByText(/Công ty ABC/)).toBeInTheDocument()
    expect(screen.getByText(/500\.000\.000/)).toBeInTheDocument()
    expect(screen.getByText(/3 ngày trước/)).toBeInTheDocument()
  })

  it('states why a card is flagged: same Document Type + Contract No + Project/Team', () => {
    render(<DupBadge hints={[hint()]} />)
    expect(screen.getByText(/Document Type \+ Contract No \+ Project\/Team/i)).toBeInTheDocument()
  })

  it('shows a draft ticket without a code as "nháp" rather than blank', () => {
    render(<DupBadge hints={[hint({ code: null })]} />)
    expect(screen.getByText('nháp')).toBeInTheDocument()
  })
})

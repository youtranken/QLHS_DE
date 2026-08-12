import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../shared/route', () => ({ openTicketDetail: vi.fn() }))
import { openTicketDetail } from '../../shared/route'
import { DupBadge } from './DupBadge'
import type { DupHint } from './api'

const hint = (over: Partial<DupHint> = {}): DupHint => ({
  id: 'dup-1',
  code: 'CT-2026-0003',
  status: 'Completed',
  flow: 'Contract',
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

  it('labels the badge compactly with the suspected ticket code', () => {
    render(<DupBadge hints={[hint()]} />)
    expect(screen.getByRole('button', { name: 'Nghi trùng hồ sơ CT-2026-0003' })).toBeInTheDocument()
  })

  it('clicking opens the suspected duplicate ticket', () => {
    render(<DupBadge hints={[hint()]} />)
    fireEvent.click(screen.getByRole('button', { name: /Nghi trùng/ }))
    expect(openTicketDetail).toHaveBeenCalledWith('CT-2026-0003')
  })

  it('summarises when more than one ticket is suspected', () => {
    render(<DupBadge hints={[hint(), hint({ id: 'dup-2', code: 'CT-2026-0009' })]} />)
    expect(screen.getByRole('button', { name: 'Nghi trùng hồ sơ CT-2026-0003 +1' })).toBeInTheDocument()
  })

  it('shows a draft ticket without a code as "nháp" rather than blank', () => {
    render(<DupBadge hints={[hint({ code: null })]} />)
    expect(screen.getByRole('button', { name: /nháp/ })).toBeInTheDocument()
  })
})

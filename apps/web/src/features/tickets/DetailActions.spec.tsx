import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DetailActions } from './DetailActions'
import type { TicketDetail } from './api'
import type { LegalAction } from '../board/api'

const act = (over: Partial<LegalAction> & { event: string; label: string }): LegalAction => ({
  toStatus: 'x',
  reversible: false,
  reasonRequired: false,
  ...over,
})

const detail = (actions: LegalAction[]): TicketDetail =>
  ({
    id: 't1', code: 'CT-2026-0001', contractor: 'ACME', amount: '1000000',
    flow: 'Contract', status: 'Submitted to DCC2 (Hardcopy)', overdueDays: 0, paused: false,
    actions,
  } as unknown as TicketDetail)

describe('DetailActions — board actions on the ticket detail', () => {
  it('renders the forward action as the primary button and opens its modal', async () => {
    const d = detail([
      act({ event: 'confirmReceivedByDcc2', label: 'Kiểm tra bản cứng' }),
      act({ event: 'sendBack', label: 'Trả lại (Return)', reasonRequired: true, toStatus: 'Returned' }),
    ])
    render(<DetailActions d={d} onDone={vi.fn().mockResolvedValue(undefined)} />)

    // Forward step is the primary button; the reason-gated Return is tucked in ⋯.
    const primary = screen.getByRole('button', { name: 'Kiểm tra bản cứng' })
    expect(primary).toBeInTheDocument()
    fireEvent.click(primary)
    // Opens the shared handover modal (not a blind transition).
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('renders nothing when the viewer has no legal action', () => {
    const { container } = render(<DetailActions d={detail([])} onDone={vi.fn().mockResolvedValue(undefined)} />)
    expect(container.querySelector('.dactions')).toBeNull()
  })
})

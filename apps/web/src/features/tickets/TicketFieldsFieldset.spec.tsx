import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('./api', () => ({ getOptions: vi.fn(), getDocumentTypes: vi.fn() }))
vi.mock('../../shared/toast', () => ({ toast: { ok: vi.fn(), err: vi.fn(), info: vi.fn() } }))
import { getOptions, getDocumentTypes, type CreateTicketBody } from './api'
import { TicketFieldsFieldset } from './TicketFieldsFieldset'

const form = (over: Partial<CreateTicketBody> = {}): CreateTicketBody => ({
  documentType: '', description: '', contractor: '', contractNo: '', projectTeam: '',
  amount: '', currency: '', paymentTerm: '', budgetCode: '', ...over,
})

describe('TicketFieldsFieldset — Contract No lock by flow', () => {
  beforeEach(() => {
    vi.mocked(getOptions).mockResolvedValue([])
    vi.mocked(getDocumentTypes).mockResolvedValue([])
  })

  it('Contract flow: locks Contract No to N/A (DCC2 assigns it) — Applicant cannot type', async () => {
    const set = vi.fn()
    render(<TicketFieldsFieldset form={form({ documentType: 'Contract' })} set={set} />)
    // The field is forced to a valid non-empty "N/A" and disabled.
    await waitFor(() => expect(set).toHaveBeenCalledWith('contractNo', 'N/A'))
    const input = screen.getByDisplayValue('N/A')
    expect(input).toBeDisabled()
    expect(screen.getByText(/DCC2 sẽ gán/)).toBeInTheDocument()
  })

  it('Payment flow: Contract No stays editable + required, no lock hint', () => {
    const set = vi.fn()
    render(<TicketFieldsFieldset form={form({ documentType: 'Payment', contractNo: 'HD-9' })} set={set} />)
    const input = screen.getByDisplayValue('HD-9')
    expect(input).not.toBeDisabled()
    expect(input).toBeRequired()
    expect(screen.queryByText(/DCC2 sẽ gán/)).not.toBeInTheDocument()
    expect(set).not.toHaveBeenCalledWith('contractNo', 'N/A')
  })
})

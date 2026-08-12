import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

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
    // The field is forced to a valid non-empty "N/A" and disabled (no hint text).
    await waitFor(() => expect(set).toHaveBeenCalledWith('contractNo', 'N/A'))
    const input = screen.getByDisplayValue('N/A')
    expect(input).toBeDisabled()
  })

  it('Payment flow: Contract No stays editable + required', () => {
    const set = vi.fn()
    render(<TicketFieldsFieldset form={form({ documentType: 'Payment', contractNo: 'HD-9' })} set={set} />)
    const input = screen.getByDisplayValue('HD-9')
    expect(input).not.toBeDisabled()
    expect(input).toBeRequired()
    expect(set).not.toHaveBeenCalledWith('contractNo', 'N/A')
  })

  it('normalises the Applicant Contract No to uppercase as they type', () => {
    const set = vi.fn()
    render(<TicketFieldsFieldset form={form({ documentType: 'Payment', contractNo: '' })} set={set} />)
    fireEvent.change(screen.getByLabelText(/Contract No/i), { target: { value: 'hd-2026/abc' } })
    expect(set).toHaveBeenCalledWith('contractNo', 'HD-2026/ABC')
  })
})

describe('TicketFieldsFieldset — Return-fixing lock (code minted)', () => {
  const GROUPS = [
    { flow: 'General', types: ['General'] },
    { flow: 'Contract', types: ['Contract', 'VO', 'Annex'] },
    { flow: 'Payment', types: ['Payment'] },
  ]
  beforeEach(() => {
    vi.mocked(getOptions).mockResolvedValue([])
    vi.mocked(getDocumentTypes).mockResolvedValue(GROUPS)
  })

  it('#2 General: Document Type is locked entirely (single-type flow)', async () => {
    render(
      <TicketFieldsFieldset
        form={form({ documentType: 'General' })}
        set={vi.fn()}
        lock={{ flow: 'General', contractNo: 'N/A', paymentNo: null }}
      />,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Document Type' })).toBeDisabled())
  })

  it('#2 Contract: Document Type stays switchable within its family', async () => {
    render(
      <TicketFieldsFieldset
        form={form({ documentType: 'VO' })}
        set={vi.fn()}
        lock={{ flow: 'Contract', contractNo: 'CT-ACC-1', paymentNo: null }}
      />,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Document Type' })).not.toBeDisabled())
  })

  it('#3 Contract: Contract No shows the DCC2 number, read-only', async () => {
    render(
      <TicketFieldsFieldset
        form={form({ documentType: 'Contract', contractNo: 'CT-ACC-42' })}
        set={vi.fn()}
        lock={{ flow: 'Contract', contractNo: 'CT-ACC-42', paymentNo: null }}
      />,
    )
    const input = screen.getByDisplayValue('CT-ACC-42')
    expect(input).toBeDisabled()
    expect(screen.queryByText('Payment No')).not.toBeInTheDocument()
  })

  it('#3 Payment: keeps Contract No editable and adds a read-only Payment No', async () => {
    render(
      <TicketFieldsFieldset
        form={form({ documentType: 'Payment', contractNo: 'HD-777' })}
        set={vi.fn()}
        lock={{ flow: 'Payment', contractNo: 'HD-777', paymentNo: 'PM-2026-9' }}
      />,
    )
    expect(screen.getByDisplayValue('HD-777')).not.toBeDisabled() // Applicant reference stays editable
    const payNo = screen.getByDisplayValue('PM-2026-9')
    expect(payNo).toBeDisabled()
    expect(screen.getByText('Payment No')).toBeInTheDocument()
  })
})

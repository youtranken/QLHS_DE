import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./api', () => ({
  createTicket: vi.fn(),
  getOptions: vi.fn(),
  getDocumentTypes: vi.fn(),
}))
vi.mock('../../shared/toast', () => ({ toast: { ok: vi.fn(), err: vi.fn(), info: vi.fn() } }))
import { createTicket, getOptions, getDocumentTypes } from './api'
import { CreateTicketForm } from './CreateTicketForm'

describe('CreateTicketForm — required dropdowns are validated (UX M1)', () => {
  beforeEach(() => {
    // Non-empty catalogs → Project/Team + Payment Term render as custom Selects,
    // which carry no native `required`.
    vi.mocked(getOptions).mockResolvedValue(['TeamA', 'NET30'])
    vi.mocked(getDocumentTypes).mockResolvedValue([])
    vi.mocked(createTicket).mockResolvedValue({ id: 'x', code: 'G-1' } as never)
  })
  afterEach(() => vi.restoreAllMocks())

  it('blocks submit and names the empty dropdowns instead of POSTing', async () => {
    render(<CreateTicketForm onCreated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ mới' }))
    const form = await screen.findByRole('dialog')
    fireEvent.submit(form)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Project\/Team|Payment Term/),
    )
    expect(createTicket).not.toHaveBeenCalled()
  })
})

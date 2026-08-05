import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ROLE, type Role } from '@qlhs/contracts'

vi.mock('./features/auth/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('./features/auth/RoleSwitcher', () => ({ RoleSwitcher: () => <div>SWITCH</div> }))
vi.mock('./features/admin/AdminUsers', () => ({ AdminUsers: () => <div>ADMIN_CONSOLE</div> }))
vi.mock('./features/admin/SlaConfigAdmin', () => ({ SlaConfigAdmin: () => <div>SLA_CONFIG</div> }))
vi.mock('./features/tickets/CreateTicketForm', () => ({ CreateTicketForm: () => <div>CREATE_FORM</div> }))
vi.mock('./features/tickets/MyTickets', () => ({
  MyTickets: ({ action }: { action?: import('react').ReactNode }) => (
    <div>
      MY_TICKETS
      {action}
    </div>
  ),
}))
vi.mock('./features/dispatch/LineMap', () => ({ LineMap: () => <div>LINE_MAP</div> }))
vi.mock('./features/board/StationBoard', () => ({ StationBoard: () => <div>STATION_BOARD</div> }))

import { useCurrentUser } from './features/auth/useCurrentUser'
import { App } from './App'

const mockHook = vi.mocked(useCurrentUser)

function authed(activeRole: Role | null, roles: Role[] = activeRole ? [activeRole] : []) {
  mockHook.mockReturnValue({
    state: { status: 'authed', user: { sub: 'u', roles, activeRole, displayName: 'U' } },
    setActiveRole: vi.fn(),
    reload: vi.fn(),
  } as unknown as ReturnType<typeof useCurrentUser>)
}

describe('App role-gating (UI reflects activeRole; server still enforces)', () => {
  beforeEach(() => mockHook.mockReset())

  it('anon → shows the unified identifier-first login (one email field)', () => {
    mockHook.mockReturnValue({
      state: { status: 'anon' },
      setActiveRole: vi.fn(),
      reload: vi.fn(),
    } as unknown as ReturnType<typeof useCurrentUser>)
    render(<App />)
    expect(screen.getByLabelText(/email hoặc tài khoản/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tiếp tục/i })).toBeInTheDocument()
    // The old two-path UI is gone: no separate PMH ID button, no local-SA header.
    expect(screen.queryByRole('button', { name: /PMH ID/i })).not.toBeInTheDocument()
  })

  it('Admin → admin console only (no applicant form)', () => {
    authed(ROLE.Admin)
    render(<App />)
    // Admin mở vào trang quản trị (landing = Tổng quan), không phải form Applicant.
    expect(screen.getByRole('navigation', { name: 'Khu quản trị' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Tổng quan quản trị' })).toBeInTheDocument()
    expect(screen.queryByText('CREATE_FORM')).not.toBeInTheDocument()
  })

  it('Applicant → create form + my tickets, no admin/board', () => {
    authed(ROLE.Applicant)
    render(<App />)
    expect(screen.getByText('CREATE_FORM')).toBeInTheDocument()
    expect(screen.getByText('MY_TICKETS')).toBeInTheDocument()
    expect(screen.queryByText('ADMIN_CONSOLE')).not.toBeInTheDocument()
    expect(screen.queryByText('STATION_BOARD')).not.toBeInTheDocument()
  })

  it('DCC1 → line map + station board', () => {
    authed(ROLE.Dcc1)
    render(<App />)
    expect(screen.getByText('LINE_MAP')).toBeInTheDocument()
    expect(screen.getByText('STATION_BOARD')).toBeInTheDocument()
  })

  it('role-less authed → prompt to contact admin', () => {
    authed(null, [])
    render(<App />)
    expect(screen.getByText(/chưa được gán vai/i)).toBeInTheDocument()
  })
})

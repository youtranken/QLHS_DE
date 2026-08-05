import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./api', () => ({
  listUsers: vi.fn(),
  setUserRoles: vi.fn(),
  getSlaConfig: vi.fn(),
  updateSla: vi.fn(),
  getAdminOverview: vi.fn(),
}))
import { listUsers, getSlaConfig, getAdminOverview } from './api'
import { AdminShell } from './AdminShell'

const OVERVIEW = {
  users: { total: 0, appointed: 0, unappointed: 0 },
  runningTotal: 0,
  overdueTotal: 0,
  auditToday: 0,
  lines: [],
  recent: [],
  mailPending: 0,
  pausedTotal: 0,
  system: { version: 'test', uptimeSeconds: 0 },
}

describe('AdminShell — sidebar console', () => {
  beforeEach(() => {
    vi.mocked(listUsers).mockResolvedValue([])
    vi.mocked(getSlaConfig).mockResolvedValue([])
    vi.mocked(getAdminOverview).mockResolvedValue(OVERVIEW)
  })
  afterEach(() => vi.restoreAllMocks())

  // Page titles were removed from each pane (the sidebar already names the
  // active section); each pane's outer <section aria-label> is the stable anchor.
  it('opens on "Tổng quan" and renders the overview pane', () => {
    render(<AdminShell />)
    expect(screen.getByRole('button', { name: /Tổng quan/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('region', { name: 'Tổng quan quản trị' })).toBeInTheDocument()
  })

  it('switches to the roles console when its nav item is clicked', async () => {
    render(<AdminShell />)
    fireEvent.click(screen.getByRole('button', { name: /Người dùng & Vai/ }))
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Người dùng & Vai' })).toBeInTheDocument(),
    )
  })

  it('switches to the SLA console when its nav item is clicked', async () => {
    render(<AdminShell />)
    fireEvent.click(screen.getByRole('button', { name: /Ngưỡng SLA/ }))
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Ngưỡng SLA' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('region', { name: 'Tổng quan quản trị' })).not.toBeInTheDocument()
  })
})

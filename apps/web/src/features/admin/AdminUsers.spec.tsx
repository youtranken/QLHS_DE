import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./api', () => ({
  listUsers: vi.fn(),
  setUserRoles: vi.fn(),
}))
import { listUsers, setUserRoles, type UserWithRoles } from './api'
import { AdminUsers } from './AdminUsers'

const USERS: UserWithRoles[] = [
  { sub: 's1', email: 'applicant@pmh.com.vn', fullName: 'Nguyễn Văn A', roles: ['Applicant'] },
  { sub: 's2', email: 'client_dcc1@pmh.com.vn', fullName: 'Trần Thị B', roles: ['DCC1'] },
]

describe('AdminUsers — quản vai theo nhóm (1 người 1 vai/nhóm)', () => {
  beforeEach(() => {
    vi.mocked(listUsers).mockResolvedValue(USERS)
    vi.mocked(setUserRoles).mockResolvedValue({ ok: true })
  })
  afterEach(() => vi.restoreAllMocks())

  it('mở mặc định nhóm DCC1, chỉ liệt kê thành viên của nhóm (không phải Applicant thuần)', async () => {
    render(<AdminUsers />)
    await waitFor(() => expect(screen.getByText('Trần Thị B')).toBeInTheDocument())
    expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument()
  })

  it('nhóm rỗng hiện trạng thái trống', async () => {
    render(<AdminUsers />)
    await waitFor(() => expect(screen.getByText('Trần Thị B')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    expect(screen.getByText(/Chưa có ai trong nhóm/)).toBeInTheDocument()
  })

  it('thêm một Applicant vào nhóm — chỉ giữ đúng vai đó', async () => {
    render(<AdminUsers />)
    await waitFor(() => expect(screen.getByText('Trần Thị B')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /DCC2/ }))
    fireEvent.change(screen.getByLabelText(/Tìm người để thêm vào DCC2/), {
      target: { value: 'Nguyễn' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Thêm Nguyễn Văn A vào DCC2/ }))
    await waitFor(() =>
      expect(setUserRoles).toHaveBeenCalledWith('s1', expect.arrayContaining(['DCC2'])),
    )
    expect(setUserRoles).toHaveBeenCalledWith('s1', expect.not.arrayContaining(['DCC1']))
  })

  it('chuyển người từ nhóm khác = gỡ vai cũ + gán vai mới', async () => {
    render(<AdminUsers />)
    await waitFor(() => expect(screen.getByText('Trần Thị B')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /DCC3/ }))
    fireEvent.change(screen.getByLabelText(/Tìm người để thêm vào DCC3/), {
      target: { value: 'Trần' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Chuyển Trần Thị B vào DCC3/ }))
    await waitFor(() =>
      expect(setUserRoles).toHaveBeenCalledWith('s2', expect.arrayContaining(['DCC3'])),
    )
    expect(setUserRoles).toHaveBeenCalledWith('s2', expect.not.arrayContaining(['DCC1']))
  })

  it('gỡ thành viên khỏi nhóm → về Applicant', async () => {
    render(<AdminUsers />)
    await waitFor(() => expect(screen.getByText('Trần Thị B')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Gỡ Trần Thị B khỏi DCC1/ }))
    await waitFor(() => expect(setUserRoles).toHaveBeenCalledWith('s2', []))
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Keep the real ApiClientError (LoginPage does `err instanceof ApiClientError`);
// only apiPost is stubbed.
vi.mock('../../shared/api-client', async (importActual) => {
  const actual = await importActual<typeof import('../../shared/api-client')>()
  return { ...actual, apiPost: vi.fn() }
})
import { apiPost, ApiClientError } from '../../shared/api-client'
import { LoginPage } from './LoginPage'

const post = vi.mocked(apiPost)
const ID = /email hoặc tài khoản/i

beforeEach(() => post.mockReset())

describe('LoginPage — one door (QLTS parity)', () => {
  it('starts with a single identifier field and no password box', () => {
    render(<LoginPage onLoggedIn={vi.fn()} />)
    expect(screen.getByLabelText(ID)).toBeInTheDocument()
    expect(screen.queryByLabelText('Mật khẩu')).not.toBeInTheDocument()
  })

  it('an email hands off to PMH ID (login_hint) client-side — no probe, no password box', async () => {
    const goSso = vi.fn()
    render(<LoginPage onLoggedIn={vi.fn()} goSso={goSso} />)

    await userEvent.type(screen.getByLabelText(ID), 'nguyen@pmh.com.vn')
    await userEvent.click(screen.getByRole('button', { name: /tiếp tục/i }))

    // The branch is decided client-side: no server round-trip (no /auth/probe).
    expect(post).not.toHaveBeenCalled()
    expect(goSso).toHaveBeenCalledWith('nguyen@pmh.com.vn')
    expect(screen.queryByLabelText('Mật khẩu')).not.toBeInTheDocument()
  })

  it('a non-email username reveals the password box, then signs in via local-login', async () => {
    const onLoggedIn = vi.fn()
    render(<LoginPage onLoggedIn={onLoggedIn} />)

    await userEvent.type(screen.getByLabelText(ID), 'admin.ssa')
    await userEvent.click(screen.getByRole('button', { name: /tiếp tục/i }))

    const pass = await screen.findByLabelText('Mật khẩu')
    post.mockResolvedValueOnce({ ok: true })
    await userEvent.type(pass, 'secret')
    await userEvent.click(screen.getByRole('button', { name: /^đăng nhập$/i }))

    expect(post).toHaveBeenCalledWith('/auth/local-login', {
      username: 'admin.ssa',
      password: 'secret',
    })
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledOnce())
  })

  it('shows a credential error without leaving the password step', async () => {
    render(<LoginPage onLoggedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(ID), 'admin.ssa')
    await userEvent.click(screen.getByRole('button', { name: /tiếp tục/i }))
    await screen.findByLabelText('Mật khẩu')

    post.mockRejectedValueOnce(new Error('401'))
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /^đăng nhập$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/không đúng/i)
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument()
  })

  it('shows the lockout message (not "wrong password") on a 429', async () => {
    render(<LoginPage onLoggedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(ID), 'admin.ssa')
    await userEvent.click(screen.getByRole('button', { name: /tiếp tục/i }))
    await screen.findByLabelText('Mật khẩu')

    post.mockRejectedValueOnce(new ApiClientError(429, 'TooManyAttempts'))
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /^đăng nhập$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/tạm khóa/i)
  })

  it('toggles password visibility with the eye button', async () => {
    render(<LoginPage onLoggedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(ID), 'admin.ssa')
    await userEvent.click(screen.getByRole('button', { name: /tiếp tục/i }))

    const pass = await screen.findByLabelText('Mật khẩu')
    expect(pass).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: /hiện mật khẩu/i }))
    expect(pass).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: /ẩn mật khẩu/i }))
    expect(pass).toHaveAttribute('type', 'password')
  })

  it('lets the user go back and correct the identifier', async () => {
    render(<LoginPage onLoggedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(ID), 'admin.ssa')
    await userEvent.click(screen.getByRole('button', { name: /tiếp tục/i }))
    await screen.findByLabelText('Mật khẩu')

    await userEvent.click(screen.getByRole('button', { name: /đổi/i }))
    expect(screen.getByLabelText(ID)).toHaveValue('admin.ssa')
    expect(screen.queryByLabelText('Mật khẩu')).not.toBeInTheDocument()
  })
})

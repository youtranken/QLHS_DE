import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./smtpApi', () => ({
  getSmtpConfig: vi.fn(),
  saveSmtpConfig: vi.fn(),
  testSmtpConfig: vi.fn(),
}))
import { getSmtpConfig, saveSmtpConfig, testSmtpConfig, type SmtpConfigView } from './smtpApi'
import { AdminConfig } from './AdminConfig'

const VIEW: SmtpConfigView = {
  host: 'smtp.pmh.com.vn', port: 587, secure: true, username: 'qlhs', from: 'qlhs@pmh.com.vn',
  hasPassword: true, source: 'db', encKeyReady: true,
}

describe('AdminConfig — SMTP settings panel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads config into the form, saves, and test-sends without echoing the password', async () => {
    vi.mocked(getSmtpConfig).mockResolvedValue(VIEW)
    vi.mocked(saveSmtpConfig).mockResolvedValue({ ok: true })
    vi.mocked(testSmtpConfig).mockResolvedValue({ ok: true })
    render(<AdminConfig />)

    await waitFor(() => expect(screen.getByDisplayValue('smtp.pmh.com.vn')).toBeInTheDocument())
    // Password field starts blank even though one is stored (write-only).
    const pw = screen.getByLabelText('Mật khẩu') as HTMLInputElement
    expect(pw.value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }))
    await waitFor(() => expect(saveSmtpConfig).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp.pmh.com.vn', port: 587 })))

    fireEvent.change(screen.getByLabelText('Gửi thử tới'), { target: { value: 'me@pmh.com.vn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thử' }))
    await waitFor(() => expect(testSmtpConfig).toHaveBeenCalledWith(expect.objectContaining({ to: 'me@pmh.com.vn' })))
  })

  it('warns when the encryption key is missing', async () => {
    vi.mocked(getSmtpConfig).mockResolvedValue({ ...VIEW, encKeyReady: false, source: 'none', hasPassword: false })
    render(<AdminConfig />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})

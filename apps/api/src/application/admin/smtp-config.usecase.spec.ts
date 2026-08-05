import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { SmtpConfigRepo } from '../../infra/prisma/config/smtp-config.repo'
import { decryptSecret } from '../../infra/crypto/crypto-secret'
import { GetSmtpConfigUseCase } from './get-smtp-config.usecase'
import { UpdateSmtpConfigUseCase, SmtpEncKeyMissingError } from './update-smtp-config.usecase'

interface Row {
  id: number
  host: string | null
  port: number | null
  secure: boolean
  username: string | null
  passwordEnc: string | null
  fromAddr: string | null
  updatedBy: string | null
}

function fakeRepo(initial: Partial<Row> | null = null) {
  let row: Row | null = initial ? ({ id: 1, host: null, port: null, secure: false, username: null, passwordEnc: null, fromAddr: null, updatedBy: null, ...initial }) : null
  const repo = {
    get: async () => row,
    upsert: async (data: Omit<Row, 'id'>) => {
      row = { id: 1, ...data }
      return row
    },
    current: () => row,
  }
  return repo as unknown as SmtpConfigRepo & { current: () => Row | null }
}

const BASE = { host: 'smtp.pmh.com.vn', port: 587, secure: true, username: 'qlhs', from: 'qlhs@pmh.com.vn' }
const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const

describe('SMTP config use-cases', () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    process.env.CONFIG_ENC_KEY = 'unit-key'
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k] }
  })
  afterEach(() => {
    delete process.env.CONFIG_ENC_KEY
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  })

  it('encrypts the password (never plaintext) and it round-trips', async () => {
    const repo = fakeRepo()
    await new UpdateSmtpConfigUseCase(repo).execute({ ...BASE, password: 's3cret' }, 'admin-sub')
    const enc = repo.current()!.passwordEnc!
    expect(enc).not.toContain('s3cret')
    expect(decryptSecret(enc)).toBe('s3cret')
    expect(repo.current()!.updatedBy).toBe('admin-sub')
  })

  it('keeps the stored password when the field is blank', async () => {
    const repo = fakeRepo({ host: 'old', passwordEnc: 'KEEP.ME.PLEASE' })
    await new UpdateSmtpConfigUseCase(repo).execute({ ...BASE, password: '' }, 'admin')
    expect(repo.current()!.passwordEnc).toBe('KEEP.ME.PLEASE')
  })

  it('refuses to save a password with no encryption key', async () => {
    delete process.env.CONFIG_ENC_KEY
    const repo = fakeRepo()
    await expect(new UpdateSmtpConfigUseCase(repo).execute({ ...BASE, password: 'x' }, 'a')).rejects.toBeInstanceOf(
      SmtpEncKeyMissingError,
    )
  })

  it('GET masks the password and reports source=db', async () => {
    const repo = fakeRepo({ host: 'smtp.x', port: 465, secure: true, username: 'u', passwordEnc: 'a.b.c', fromAddr: 'f@x' })
    const view = await new GetSmtpConfigUseCase(repo).execute()
    expect(view).toMatchObject({ host: 'smtp.x', port: 465, secure: true, hasPassword: true, source: 'db' })
    expect(JSON.stringify(view)).not.toContain('a.b.c') // no ciphertext leaks either
    expect(view).not.toHaveProperty('password')
  })

  it('GET falls back to env when no DB row, then none', async () => {
    const repo = fakeRepo()
    process.env.SMTP_HOST = 'localhost'
    process.env.SMTP_PORT = '11025'
    expect(await new GetSmtpConfigUseCase(repo).execute()).toMatchObject({ host: 'localhost', port: 11025, source: 'env' })
    delete process.env.SMTP_HOST
    expect(await new GetSmtpConfigUseCase(repo).execute()).toMatchObject({ source: 'none', hasPassword: false })
  })
})

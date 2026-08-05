import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { SmtpConfigRepo } from '../prisma/config/smtp-config.repo'
import { decryptSecret, hasEncKey } from '../crypto/crypto-secret'

export interface EffectiveSmtp {
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
  from: string
  source: 'db' | 'env'
}

const DEFAULT_FROM = 'qlhs@pmh.com.vn'

/**
 * Resolves the SMTP config the mailer should actually use: the DB row (admin UI)
 * takes precedence; if it has no host, fall back to the SMTP_* env vars (dev =
 * Mailpit). The DB password is decrypted here. Returns null when NEITHER is
 * configured — the caller then knows email can't be sent.
 */
@Injectable()
export class SmtpResolver {
  private readonly log = new Logger(SmtpResolver.name)
  constructor(private readonly repo: SmtpConfigRepo) {}

  async effective(): Promise<EffectiveSmtp | null> {
    const row = await this.repo.get()
    if (row?.host) {
      return {
        host: row.host,
        port: row.port ?? 587,
        secure: row.secure,
        user: row.username ?? undefined,
        pass: this.decryptPassword(row.passwordEnc),
        from: row.fromAddr ?? process.env.SMTP_FROM ?? DEFAULT_FROM,
        source: 'db',
      }
    }
    const host = process.env.SMTP_HOST
    if (!host) return null
    return {
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      from: process.env.SMTP_FROM ?? DEFAULT_FROM,
      source: 'env',
    }
  }

  /** A stored password with no key to decrypt it can't help — log once, drop it. */
  private decryptPassword(enc: string | null): string | undefined {
    if (!enc) return undefined
    if (!hasEncKey()) {
      this.log.error('smtp_config có mật khẩu nhưng thiếu CONFIG_ENC_KEY — bỏ qua mật khẩu.')
      return undefined
    }
    try {
      return decryptSecret(enc)
    } catch {
      this.log.error('Giải mã mật khẩu SMTP thất bại (key sai?) — bỏ qua mật khẩu.')
      return undefined
    }
  }
}

/** Stable fingerprint of an effective config → the mailer rebuilds its transport
 *  only when something actually changed (admin edit), not on every send. */
export function smtpFingerprint(c: EffectiveSmtp): string {
  return createHash('sha256')
    .update([c.host, c.port, c.secure, c.user ?? '', c.pass ?? '', c.from].join('|'))
    .digest('hex')
}

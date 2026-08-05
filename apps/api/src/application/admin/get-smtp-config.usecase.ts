import { Injectable } from '@nestjs/common'
import { SmtpConfigRepo } from '../../infra/prisma/config/smtp-config.repo'
import { hasEncKey } from '../../infra/crypto/crypto-secret'

/** What the admin form sees. NEVER carries the password value — only whether one
 *  is set. `source` says where the ACTIVE config currently comes from. */
export interface SmtpConfigView {
  host: string
  port: number
  secure: boolean
  username: string
  from: string
  hasPassword: boolean
  source: 'db' | 'env' | 'none'
  encKeyReady: boolean
}

@Injectable()
export class GetSmtpConfigUseCase {
  constructor(private readonly repo: SmtpConfigRepo) {}

  async execute(): Promise<SmtpConfigView> {
    const row = await this.repo.get()
    const encKeyReady = hasEncKey()
    if (row?.host) {
      return {
        host: row.host,
        port: row.port ?? 587,
        secure: row.secure,
        username: row.username ?? '',
        from: row.fromAddr ?? '',
        hasPassword: !!row.passwordEnc,
        source: 'db',
        encKeyReady,
      }
    }
    // No DB config yet — reflect the env fallback so the form shows what's live.
    const envHost = process.env.SMTP_HOST
    if (envHost) {
      return {
        host: envHost,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        username: process.env.SMTP_USER ?? '',
        from: process.env.SMTP_FROM ?? '',
        hasPassword: !!process.env.SMTP_PASS,
        source: 'env',
        encKeyReady,
      }
    }
    return { host: '', port: 587, secure: false, username: '', from: '', hasPassword: false, source: 'none', encKeyReady }
  }
}

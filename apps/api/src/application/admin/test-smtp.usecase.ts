import { Injectable } from '@nestjs/common'
import { SmtpConfigRepo } from '../../infra/prisma/config/smtp-config.repo'
import { decryptSecret, hasEncKey } from '../../infra/crypto/crypto-secret'
import { buildTransport } from '../../infra/mail/nodemailer.mail'
import { renderMail } from '../../domain/notify/email-layout'
import type { SmtpConfigInput } from './update-smtp-config.usecase'

export interface SmtpTestInput extends SmtpConfigInput {
  to: string
}

/** Send a one-off test email using the POSTED form values (so an admin can verify
 *  BEFORE saving). If the password field is blank, reuse the stored one — lets
 *  the operator test a tweaked host/port without re-typing the secret. Any SMTP
 *  failure propagates so the controller can surface the real reason. */
@Injectable()
export class TestSmtpUseCase {
  constructor(private readonly repo: SmtpConfigRepo) {}

  async execute(input: SmtpTestInput): Promise<void> {
    const pass = await this.resolvePassword(input.password)
    const transport = buildTransport({
      host: input.host,
      port: input.port,
      secure: input.secure,
      user: input.username || undefined,
      pass,
      from: input.from,
      source: 'db',
    })
    const { html, text } = renderMail({
      title: 'Email thử cấu hình SMTP',
      preheader: 'Email thử từ QLHS — xác nhận cấu hình SMTP hoạt động.',
      intro:
        'Đây là email thử từ QLHS. Nếu bạn nhận được thư này, cấu hình SMTP đang hoạt động bình thường.',
    })
    await transport.sendMail({
      from: input.from,
      to: input.to,
      subject: 'QLHS — email thử cấu hình SMTP',
      text,
      html,
    })
  }

  private async resolvePassword(typed?: string): Promise<string | undefined> {
    if (typed && typed.length > 0) return typed
    const row = await this.repo.get()
    if (row?.passwordEnc && hasEncKey()) {
      try {
        return decryptSecret(row.passwordEnc)
      } catch {
        return undefined
      }
    }
    return undefined
  }
}

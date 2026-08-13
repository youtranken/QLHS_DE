import { Injectable, Logger } from '@nestjs/common'
import nodemailer, { type Transporter } from 'nodemailer'
import { MailPort, type Mail } from '../../domain/ports/mail.port'
import { SmtpResolver, smtpFingerprint, type EffectiveSmtp } from './smtp-resolver'
import { parseSuppressList, isSuppressed } from './suppress-list'

/** SMTP implementation of MailPort (AD-12). Config comes from the DB (admin UI)
 *  with an env fallback, resolved per send; the transport is cached by config
 *  fingerprint so an admin edit rebuilds it without a restart. The domain/
 *  dispatcher never imports nodemailer — only this adapter does. */
@Injectable()
export class NodemailerMailPort extends MailPort {
  private readonly log = new Logger(NodemailerMailPort.name)
  private transport: Transporter | null = null
  private fp = ''
  private from = process.env.SMTP_FROM ?? 'qlhs@pmh.com.vn'
  private readonly suppress = parseSuppressList(process.env.QLHS_MAIL_SUPPRESS)

  constructor(private readonly smtp: SmtpResolver) {
    super()
  }

  async send(mail: Mail): Promise<void> {
    // Bỏ qua trong im lặng (không throw) để dispatcher đánh dấu đã xử lý,
    // không retry mãi các địa chỉ chủ đích không nhận mail.
    if (isSuppressed(mail.to, this.suppress)) {
      this.log.debug(`suppressed mail to ${mail.to} (${mail.subject})`)
      return
    }
    const tx = await this.transporter()
    await tx.sendMail({
      from: this.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.body,
      ...(mail.html ? { html: mail.html } : {}),
    })
  }

  private async transporter(): Promise<Transporter> {
    const cfg = await this.smtp.effective()
    if (!cfg) throw new Error('SMTP chưa cấu hình (cả DB lẫn env đều trống).')
    const fp = smtpFingerprint(cfg)
    if (!this.transport || fp !== this.fp) {
      this.transport = buildTransport(cfg)
      this.fp = fp
      this.from = cfg.from
    }
    return this.transport
  }
}

/** One place that turns an effective config into a Nodemailer transport, shared
 *  by the mailer and the "test send" use-case. Bounded timeouts so a black-hole
 *  host fails fast instead of stalling the dispatcher's in-flight guard. */
export function buildTransport(cfg: EffectiveSmtp): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
}

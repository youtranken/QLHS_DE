import { Injectable } from '@nestjs/common'
import { SmtpConfigRepo } from '../../infra/prisma/config/smtp-config.repo'
import { encryptSecret, hasEncKey } from '../../infra/crypto/crypto-secret'

export interface SmtpConfigInput {
  host: string
  port: number
  secure: boolean
  username: string
  /** New password; omit/empty to KEEP the stored one (so the form never has to
   *  echo the secret back to be re-saved). */
  password?: string
  from: string
}

/** Thrown when a password is being set but no encryption key exists — the
 *  controller maps this to a 400 with a clear message. */
export class SmtpEncKeyMissingError extends Error {
  readonly code = 'SmtpEncKeyMissing'
  constructor() {
    super('CONFIG_ENC_KEY chưa cấu hình — không thể lưu mật khẩu SMTP an toàn.')
  }
}

const blankToNull = (v: string): string | null => (v.trim() === '' ? null : v.trim())

@Injectable()
export class UpdateSmtpConfigUseCase {
  constructor(private readonly repo: SmtpConfigRepo) {}

  async execute(input: SmtpConfigInput, actorSub: string): Promise<void> {
    const current = await this.repo.get()
    let passwordEnc = current?.passwordEnc ?? null
    if (input.password && input.password.length > 0) {
      if (!hasEncKey()) throw new SmtpEncKeyMissingError()
      passwordEnc = encryptSecret(input.password)
    }
    await this.repo.upsert({
      host: blankToNull(input.host),
      port: input.port,
      secure: input.secure,
      username: blankToNull(input.username),
      passwordEnc,
      fromAddr: blankToNull(input.from),
      updatedBy: actorSub,
    })
  }
}

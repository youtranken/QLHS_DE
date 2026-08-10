/** Outbound email boundary (AD-12). The domain/dispatcher speaks only this port;
 *  the SMTP (Nodemailer) implementation lives in infra and is swapped in tests. */
export interface Mail {
  to: string
  subject: string
  /** Bản text thuần (fallback cho client không đọc HTML). */
  body: string
  /** Bản HTML có thương hiệu (tùy chọn); có thì nodemailer gửi cả text lẫn html. */
  html?: string
}

export abstract class MailPort {
  abstract send(mail: Mail): Promise<void>
}

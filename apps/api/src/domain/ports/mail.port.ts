/** Outbound email boundary (AD-12). The domain/dispatcher speaks only this port;
 *  the SMTP (Nodemailer) implementation lives in infra and is swapped in tests. */
export interface Mail {
  to: string
  subject: string
  body: string
}

export abstract class MailPort {
  abstract send(mail: Mail): Promise<void>
}

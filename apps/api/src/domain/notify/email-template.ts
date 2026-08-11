import { TICKET_STATUS } from '@qlhs/contracts'
import { renderMail, type MailContent } from './email-layout'

/** Outbox `kind` values. `Completed`/`Returned` mirror the status (Epic 3 wrote
 *  `Completed` already); `return_reminder` is the Return-fixing nudge (Story 5.2).
 *  `auto_returned` is the Pool auto-return notice — a DISTINCT kind so its
 *  UNIQUE(ticket, round, kind) dedup never collides with a manual `Returned` in
 *  the same round (which would silently swallow the auto-return email). */
export const NOTIFICATION_KIND = {
  Completed: TICKET_STATUS.Completed,
  Returned: TICKET_STATUS.Returned,
  ReturnReminder: 'return_reminder',
  AutoReturned: 'auto_returned',
} as const

export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND]

export interface TemplateInput {
  kind: string
  code: string | null
}

/**
 * The email for a notification kind (AD-15). Minimal bilingual content; the ticket
 * code is the only variable. Wrapped in the QLHS layout → both `html` (branded) and
 * `body` (text fallback). Recipient email is resolved by the dispatcher from the
 * local directory cache (join by `sub`).
 */
export function emailTemplate({ kind, code }: TemplateInput): {
  subject: string
  body: string
  html: string
} {
  const ref = code ?? '(chưa cấp mã)'
  const spec = ((): { subject: string } & MailContent => {
    switch (kind) {
      case NOTIFICATION_KIND.Completed:
        return {
          subject: `[QLHS] Hồ sơ ${ref} đã hoàn tất`,
          title: 'Hồ sơ đã hoàn tất',
          tone: 'success',
          preheader: `Hồ sơ ${ref} đã được xử lý xong.`,
          intro: [
            `Hồ sơ ${ref} của bạn đã được xử lý xong (Completed).`,
            `Your document ${ref} has been completed.`,
          ],
        }
      case NOTIFICATION_KIND.Returned:
        return {
          subject: `[QLHS] Hồ sơ ${ref} bị trả lại — cần bổ sung`,
          title: 'Hồ sơ bị trả lại',
          tone: 'warn',
          preheader: `Hồ sơ ${ref} bị trả lại — cần bổ sung.`,
          intro: [
            `Hồ sơ ${ref} đã được trả lại. Vui lòng nhận lại bản cứng và bổ sung.`,
            `Document ${ref} was returned; please collect it and resubmit.`,
          ],
        }
      case NOTIFICATION_KIND.AutoReturned:
        return {
          subject: `[QLHS] Hồ sơ ${ref} bị tự động trả lại — quá hạn tiếp nhận`,
          title: 'Hồ sơ bị tự động trả lại',
          tone: 'warn',
          preheader: `Hồ sơ ${ref} bị tự động trả lại do quá hạn tiếp nhận.`,
          intro: [
            `Hồ sơ ${ref} bị tự động trả lại vì quá hạn tiếp nhận ở Pool (chưa có ai xử lý). Vui lòng kiểm tra và nộp lại.`,
            `Document ${ref} was auto-returned (not picked up in time); please review and resubmit.`,
          ],
        }
      case NOTIFICATION_KIND.ReturnReminder:
        return {
          subject: `[QLHS] Nhắc: hồ sơ ${ref} chờ bạn nộp lại`,
          title: 'Nhắc nộp lại hồ sơ',
          tone: 'warn',
          preheader: `Hồ sơ ${ref} đang chờ bạn nộp lại.`,
          intro: [
            `Hồ sơ ${ref} đang chờ bạn sửa và nộp lại (>3 ngày).`,
            `Document ${ref} is awaiting your resubmission (over 3 days).`,
          ],
        }
      default:
        return {
          subject: `[QLHS] ${ref}`,
          title: 'Cập nhật hồ sơ',
          tone: 'info',
          intro: `Cập nhật hồ sơ ${ref}.`,
        }
    }
  })()
  const { subject, ...content } = spec
  const { html, text } = renderMail(content)
  return { subject, body: text, html }
}

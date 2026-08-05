import { TICKET_STATUS } from '@qlhs/contracts'

/** Outbox `kind` values. `Completed`/`Returned` mirror the status (Epic 3 wrote
 *  `Completed` already); `return_reminder` is the Return-fixing nudge (Story 5.2). */
export const NOTIFICATION_KIND = {
  Completed: TICKET_STATUS.Completed,
  Returned: TICKET_STATUS.Returned,
  ReturnReminder: 'return_reminder',
} as const

export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND]

export interface TemplateInput {
  kind: string
  code: string | null
}

/**
 * The email body for a notification kind (AD-15). Minimal bilingual text; the
 * ticket code is the only variable. Recipient name/email is resolved by the
 * dispatcher from the local directory cache (join by `sub`).
 */
export function emailTemplate({ kind, code }: TemplateInput): { subject: string; body: string } {
  const ref = code ?? '(chưa cấp mã)'
  switch (kind) {
    case NOTIFICATION_KIND.Completed:
      return {
        subject: `[QLHS] Hồ sơ ${ref} đã hoàn tất`,
        body: `Hồ sơ ${ref} của bạn đã được xử lý xong (Completed). / Your document ${ref} has been completed.`,
      }
    case NOTIFICATION_KIND.Returned:
      return {
        subject: `[QLHS] Hồ sơ ${ref} bị trả lại — cần bổ sung`,
        body: `Hồ sơ ${ref} đã được trả lại. Vui lòng nhận lại bản cứng và bổ sung. / Document ${ref} was returned; please collect it and resubmit.`,
      }
    case NOTIFICATION_KIND.ReturnReminder:
      return {
        subject: `[QLHS] Nhắc: hồ sơ ${ref} chờ bạn nộp lại`,
        body: `Hồ sơ ${ref} đang chờ bạn sửa và nộp lại (>3 ngày). / Document ${ref} is awaiting your resubmission (over 3 days).`,
      }
    default:
      return { subject: `[QLHS] ${ref}`, body: `Cập nhật hồ sơ ${ref}.` }
  }
}

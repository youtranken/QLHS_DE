import type { Digest, DigestLine } from './digest'

export interface DigestTemplateInput {
  digest: Digest
  /** Display name (AD-12) — never the raw PMH sub. */
  name: string
  date: Date
}

const VI_DATE = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
})

function ref(t: DigestLine): string {
  return `${t.code ?? '(chưa cấp mã)'} · ${t.flow}`
}

function deadline(t: DigestLine): string {
  if (t.daysLeft <= 0) return 'hết hạn hôm nay'
  return t.daysLeft === 1 ? 'hết hạn ngày mai' : `còn ${t.daysLeft} ngày`
}

function section(title: string, lines: DigestLine[], describe: (t: DigestLine) => string): string {
  if (lines.length === 0) return ''
  const rows = lines.map((t) => `  - ${ref(t)} — ${describe(t)}`).join('\n')
  return `${title} (${lines.length})\n${rows}\n\n`
}

/**
 * F11 — the 7h30 digest for a DCC. Plain text on purpose: it is read on a phone
 * at the start of the day, and every line must answer "which ticket, how urgent".
 * Counts are only mentioned when non-zero — a subject reading "0 trễ" every
 * morning is exactly how people learn to ignore a mailbox.
 */
export function digestTemplate({ digest, name, date }: DigestTemplateInput): { subject: string; body: string } {
  const counts = [
    digest.overdue.length > 0 ? `${digest.overdue.length} hồ sơ TRỄ` : null,
    digest.dueSoon.length > 0 ? `${digest.dueSoon.length} sắp trễ` : null,
    digest.awaiting.length > 0 ? `${digest.awaiting.length} chờ xác nhận` : null,
  ].filter((s): s is string => s !== null)

  const subject = `[QLHS] Sáng ${VI_DATE.format(date)} — ${counts.join(' · ')}`

  const body =
    `Chào ${name}, tình hình các hồ sơ của bạn sáng nay:\n\n` +
    section('🔴 Đã trễ', digest.overdue, (t) => `trễ ${t.overdueDays} ngày tại "${t.status}"`) +
    section('🟡 Sắp trễ', digest.dueSoon, (t) => `${deadline(t)} tại "${t.status}"`) +
    section('📥 Chờ bạn xác nhận', digest.awaiting, (t) => `đang ở "${t.status}"`) +
    'Mở QLHS để xử lý.\n' +
    '(Email tự động 7h30 ngày làm việc, chỉ gửi khi có việc cần chú ý. ' +
    'Tắt trong QLHS: menu tài khoản → "Nhắc việc buổi sáng".)'

  return { subject, body }
}

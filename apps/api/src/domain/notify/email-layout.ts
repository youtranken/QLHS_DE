/**
 * Khung email HTML dùng chung cho mọi mail QLHS (thông báo hồ sơ + gửi thử SMTP).
 * Sinh CẢ html (bảng inline-style, an toàn mọi mail client) LẪN text từ một object
 * nội dung → mọi mail đồng bộ thương hiệu QLHS. Ưu tiên:
 *  - TƯƠNG THÍCH: layout bằng <table role="presentation"> + CSS INLINE (client email
 *    bỏ qua <style>/JS). Có bgcolor fallback cho Outlook.
 *  - AN TOÀN: KHÔNG JS, KHÔNG ảnh ngoài. Mọi giá trị động được escape tại đây.
 */

export type MailTone = 'info' | 'success' | 'warn'

export interface MailContent {
  /** Nhãn badge dưới header (trạng thái/loại thông báo). */
  title: string
  /** Dòng xem trước (ẩn) hiện trong hộp thư trước khi mở. */
  preheader?: string
  /** Một hoặc nhiều đoạn mở đầu (vd song ngữ vi/en). */
  intro: string | string[]
  tone?: MailTone
  footerNote?: string
}

const TONE: Record<MailTone, { bar: string; soft: string; text: string }> = {
  info: { bar: '#2563eb', soft: '#eff6ff', text: '#1e3a8a' },
  success: { bar: '#16a34a', soft: '#f0fdf4', text: '#166534' },
  warn: { bar: '#d97706', soft: '#fffbeb', text: '#92400e' },
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const asArray = (v: string | string[]): string[] => (Array.isArray(v) ? v : [v])

/** Dựng email QLHS từ nội dung → { html, text }. text giữ nguyên câu chữ để
 *  client không đọc HTML vẫn đủ thông tin (và không phá test outbox). */
export function renderMail(content: MailContent): { html: string; text: string } {
  const tone = TONE[content.tone ?? 'info']
  const intros = asArray(content.intro)

  const introHtml = intros
    .map(
      (p) =>
        `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6">${esc(p)}</p>`,
    )
    .join('')

  const preheader = content.preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(content.preheader)}</span>`
    : ''

  const html = `<!doctype html><html lang="vi"><body style="margin:0;padding:0;background:#f1f5f9">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f1f5f9;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <tr><td style="height:4px;background:${tone.bar};font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:18px 28px 0">
        <span style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:.5px;color:#0f172a">QLHS</span>
        <span style="font-family:${FONT};font-size:12px;color:#94a3b8"> · Hệ thống Quản lý Hồ sơ</span>
      </td></tr>
      <tr><td style="padding:14px 28px 4px">
        <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:${tone.soft};color:${tone.text};font-family:${FONT};font-size:12px;font-weight:600">${esc(content.title)}</div>
      </td></tr>
      <tr><td style="padding:12px 28px 24px;font-family:${FONT}">
        ${introHtml}
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #f1f5f9;font-family:${FONT};font-size:12px;color:#94a3b8;line-height:1.5">
        ${esc(content.footerNote ?? 'Email tự động từ QLHS — vui lòng không trả lời email này.')}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const text = [content.title, '', ...intros].join('\n')
  return { html, text }
}

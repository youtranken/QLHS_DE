import { FLOW, TICKET_STATUS, type Flow, type TicketStatus } from '@qlhs/contracts'

/** Bỏ dấu tiếng Việt + hạ thường để so khớp từ khoá; text gốc dành cho regex mã. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/** Khớp CỤM như một token (biên hai phía không phải chữ/số) trên text đã fold. */
export function hasPhrase(folded: string, phrase: string): boolean {
  const body = phrase.replace(/\s+/g, '\\s+')
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`).test(folded)
}

export interface Slots {
  code?: string
  flow?: Flow
  status?: TicketStatus
  overdue?: boolean
  urgent?: boolean
  unread?: boolean
  /** true = chỉ hồ sơ đang mở; false = gồm đã đóng; undefined = mặc định. */
  openOnly?: boolean
}

/** Mã hồ sơ chạy trên TEXT GỐC (không fold) — `G-2026-0001` / `CT-2026-0001`. */
const CODE_RE = /\b(?:G|CT)-\d{4}-\d{4}\b/i

// "chung" cố ý bị loại (bẫy "nói chung / thông tin chung").
const FLOW_WORDS: ReadonlyArray<readonly [string, Flow]> = [
  ['tong hop', FLOW.General],
  ['general', FLOW.General],
  ['hop dong', FLOW.Contract],
  ['contract', FLOW.Contract],
  ['hd', FLOW.Contract],
  ['thanh toan', FLOW.Payment],
  ['chi tra', FLOW.Payment],
  ['payment', FLOW.Payment],
]

const STATUS_WORDS: ReadonlyArray<readonly [string, TicketStatus]> = [
  ['hoan tat', TICKET_STATUS.Completed],
  ['hoan thanh', TICKET_STATUS.Completed],
  ['completed', TICKET_STATUS.Completed],
  ['tra lai', TICKET_STATUS.Returned],
  ['bi tra', TICKET_STATUS.Returned],
  ['returned', TICKET_STATUS.Returned],
  ['thu hoi', TICKET_STATUS.Cancelled],
  ['da huy', TICKET_STATUS.Cancelled],
  ['cancelled', TICKET_STATUS.Cancelled],
]

const OVERDUE = ['tre', 'tre han', 'qua han', 'overdue']
const URGENT = ['gap', 'uu tien', 'urgent', 'khan']
const UNREAD = ['chua doc', 'unread']
const OPEN = ['dang mo', 'dang xu ly', 'chua dong', 'active']
const CLOSED_HINT = ['da dong', 'dong roi', 'tat ca', 'toan bo']

export function extractSlots(text: string): Slots {
  const s: Slots = {}
  const code = text.match(CODE_RE)?.[0]?.toUpperCase()
  if (code) s.code = code

  const n = fold(text)
  for (const [w, f] of FLOW_WORDS) if (hasPhrase(n, w)) { s.flow = f; break }
  for (const [w, st] of STATUS_WORDS) if (hasPhrase(n, w)) { s.status = st; break }
  if (OVERDUE.some((w) => hasPhrase(n, w))) s.overdue = true
  if (URGENT.some((w) => hasPhrase(n, w))) s.urgent = true
  if (UNREAD.some((w) => hasPhrase(n, w))) s.unread = true
  if (OPEN.some((w) => hasPhrase(n, w))) s.openOnly = true
  else if (CLOSED_HINT.some((w) => hasPhrase(n, w))) s.openOnly = false
  return s
}

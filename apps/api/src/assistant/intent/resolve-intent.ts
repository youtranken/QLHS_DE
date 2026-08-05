import { type Role } from '@qlhs/contracts'
import { extractSlots, fold, hasPhrase, type Slots } from './slots'
import { hasAny, MYTICKETS_KW, NEXT_KW, NOTIF_KW, RULES } from './intents'
import { chipFor, defaultSuggestions } from './suggestions'
import { allowsRole, TOOL, type Filters, type Intent, type ToolName } from './types'

function filtersFrom(s: Slots): Filters | undefined {
  const f: Filters = {}
  if (s.flow) f.flow = s.flow
  if (s.status) f.status = s.status
  if (s.overdue) f.overdue = true
  if (s.urgent) f.urgent = true
  if (s.openOnly !== undefined) f.openOnly = s.openOnly
  return Object.keys(f).length ? f : undefined
}

/** Dựng intent tool + args/filters đúng cho từng tool. */
function buildTool(tool: ToolName, s: Slots, n: string): Intent {
  switch (tool) {
    case TOOL.Notifications:
      return { kind: 'tool', tool, args: { unreadOnly: !!s.unread } }
    case TOOL.MyTickets:
      return { kind: 'tool', tool, args: {}, filters: filtersFrom(s) }
    case TOOL.StationTickets:
      return { kind: 'tool', tool, args: { status: s.status, flow: s.flow } }
    case TOOL.Analytics:
      return { kind: 'tool', tool, args: { period: hasPhrase(n, 'tuan') ? 'week' : 'month' } }
    default:
      return { kind: 'tool', tool, args: {} }
  }
}

/**
 * Một mệnh đề → một ý. Tất định, không LLM. Mã hồ sơ (chi tiết/bước-tiếp) trước;
 * rồi bảng RULES theo thứ tự, lọc theo `activeRole` (khớp-nhưng-sai-vai → bỏ qua,
 * không lộ tool ngoài quyền). Không khớp → unknown + gợi ý hợp vai.
 */
export function resolveIntent(text: string, activeRole: Role | null, _roles: readonly Role[]): Intent {
  const s = extractSlots(text)
  const n = fold(text)

  if (s.code) {
    const tool = hasAny(n, NEXT_KW) ? TOOL.WhatsNext : TOOL.TicketDetail
    return { kind: 'tool', tool, args: { code: s.code } }
  }

  // "thông báo" lẫn "hồ sơ của tôi" trong CÙNG mệnh đề → hỏi lại.
  if (hasAny(n, NOTIF_KW) && hasAny(n, MYTICKETS_KW)) {
    return {
      kind: 'clarify',
      reason: 'Bạn muốn xem thông báo hay danh sách hồ sơ?',
      suggestions: [chipFor(TOOL.Notifications), chipFor(TOOL.MyTickets)],
    }
  }

  for (const r of RULES) {
    if (r.match(n, s) && allowsRole(r.tool, activeRole)) return buildTool(r.tool, s, n)
  }

  return { kind: 'unknown', suggestions: defaultSuggestions(activeRole) }
}

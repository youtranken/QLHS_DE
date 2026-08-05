import { ALL_ROLES, ROLE, type Flow, type Role, type TicketStatus } from '@qlhs/contracts'

/** Tên tool (một nguồn sự thật, tránh gõ sai giữa intent ⇄ tool ⇄ registry). */
export const TOOL = {
  MyTickets: 'get_my_tickets',
  TicketDetail: 'get_ticket_detail',
  WhatsNext: 'whats_next',
  Notifications: 'get_my_notifications',
  ClosedLookup: 'closed_lookup',
  Workbox: 'get_my_workbox',
  DispatchMap: 'get_dispatch_map',
  StationTickets: 'get_station_tickets',
  Paused: 'get_paused_tickets',
  Overview: 'get_overview',
  Analytics: 'get_analytics',
  Audit: 'search_audit',
} as const

export type ToolName = (typeof TOOL)[keyof typeof TOOL]

const DCC_ADMIN: readonly Role[] = [ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3, ROLE.Admin]
const DCC: readonly Role[] = [ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3]
const ADMIN: readonly Role[] = [ROLE.Admin]

/** activeRole được THẤY/gọi mỗi tool — nguồn sự thật CHUNG cho cả intent-gating
 *  (thuần) lẫn `AssistantTool.activeRoles` (DI). Không lộ tool ngoài vai. */
export const TOOL_ROLES: Record<ToolName, readonly Role[]> = {
  [TOOL.MyTickets]: ALL_ROLES,
  [TOOL.TicketDetail]: ALL_ROLES,
  [TOOL.WhatsNext]: ALL_ROLES,
  [TOOL.Notifications]: ALL_ROLES,
  [TOOL.ClosedLookup]: DCC_ADMIN,
  [TOOL.Workbox]: DCC,
  [TOOL.DispatchMap]: DCC_ADMIN,
  [TOOL.StationTickets]: DCC_ADMIN,
  [TOOL.Paused]: ADMIN,
  [TOOL.Overview]: ADMIN,
  [TOOL.Analytics]: ADMIN,
  [TOOL.Audit]: ADMIN,
}

export function allowsRole(tool: ToolName, activeRole: Role | null): boolean {
  return activeRole !== null && TOOL_ROLES[tool].includes(activeRole)
}

/** Gợi ý bấm-chọn: `text` là câu sẽ gửi lại khi người dùng bấm chip. */
export interface Chip {
  label: string
  text: string
}

/** Bộ lọc hậu-kỳ áp lên kết quả tool (không phải tham số use-case). */
export interface Filters {
  flow?: Flow
  status?: TicketStatus
  overdue?: boolean
  urgent?: boolean
  /** true = chỉ hồ sơ đang mở; false = gồm đã đóng. */
  openOnly?: boolean
}

export type Intent =
  | { kind: 'tool'; tool: string; args: Record<string, unknown>; filters?: Filters }
  | { kind: 'clarify'; reason: string; suggestions: Chip[] }
  | { kind: 'unknown'; suggestions: Chip[] }

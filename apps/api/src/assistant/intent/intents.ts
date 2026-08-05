import { hasPhrase, type Slots } from './slots'
import { TOOL, type ToolName } from './types'

export function hasAny(folded: string, kws: readonly string[]): boolean {
  return kws.some((k) => hasPhrase(folded, k))
}

/** Chỉ dùng khi ĐÃ có mã hồ sơ → phân biệt "bước tiếp" vs "chi tiết". */
export const NEXT_KW = ['buoc tiep', 'buoc tiep theo', 'tiep theo', 'lam gi tiep', 'lam gi', 'hanh dong', 'next']
export const NOTIF_KW = ['thong bao', 'notification']

/** Yêu cầu ngữ cảnh "hồ sơ/việc" — không lấy trần "của tôi". */
export const MYTICKETS_KW = [
  'ho so cua toi',
  'ho so cua minh',
  'danh sach ho so',
  'ho so dang mo',
  'viec cua toi',
  'ho so cua',
  'ho so',
]

const WORKBOX_KW = ['ban cua toi', 'ban lam viec', 'workbox', 'viec can lam', 'can xu ly', 'cho toi xu ly', 'viec cua toi', 'hop thu viec']
const DISPATCH_KW = ['ban do', 'so do tuyen', 'dispatch', 'tuyen ho so', 'ban do tuyen']
const STATION_KW = ['o buoc', 'o tram', 'tai tram', 'o trang thai', 'dang o', 'o ga', 'tram']
const CLOSED_KW = ['da dong', 'da xong', 'ho so cu', 'lich su ho so', 'tra cuu dong', 'ho so dong']
const PAUSED_KW = ['tam dung', 'cho bo sung', 'tam hoan', 'pause', 'dung sla', 'ngung sla']
const OVERVIEW_KW = ['tong quan', 'bang dieu khien', 'overview', 'tinh hinh chung', 'dashboard']
const ANALYTICS_KW = ['phan tich', 'thong ke', 'analytics', 'bao cao', 'so lieu', 'nang suat']
const AUDIT_KW = ['nhat ky', 'nhat ki', 'lich su thao tac', 'audit', 'ai da lam', 've ky']

export function isFilterOnly(s: Slots): boolean {
  return !!(s.flow || s.status || s.overdue || s.urgent || s.openOnly !== undefined)
}

export interface IntentRule {
  tool: ToolName
  match(n: string, s: Slots): boolean
}

/** Luật theo THỨ TỰ (đặc thù → chung). Rule đầu tiên khớp VÀ đúng vai thắng;
 *  khớp nhưng sai vai thì bỏ qua (rơi xuống → cuối cùng unknown, KHÔNG lộ tool). */
export const RULES: readonly IntentRule[] = [
  { tool: TOOL.Paused, match: (n) => hasAny(n, PAUSED_KW) },
  { tool: TOOL.Overview, match: (n) => hasAny(n, OVERVIEW_KW) },
  { tool: TOOL.Analytics, match: (n) => hasAny(n, ANALYTICS_KW) },
  { tool: TOOL.Audit, match: (n) => hasAny(n, AUDIT_KW) },
  { tool: TOOL.DispatchMap, match: (n) => hasAny(n, DISPATCH_KW) },
  { tool: TOOL.StationTickets, match: (n, s) => !!s.status && hasAny(n, STATION_KW) },
  { tool: TOOL.Workbox, match: (n) => hasAny(n, WORKBOX_KW) },
  { tool: TOOL.Notifications, match: (n) => hasAny(n, NOTIF_KW) },
  { tool: TOOL.ClosedLookup, match: (n) => hasAny(n, CLOSED_KW) },
  { tool: TOOL.MyTickets, match: (n, s) => hasAny(n, MYTICKETS_KW) || isFilterOnly(s) },
]

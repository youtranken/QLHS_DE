import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '../../shared/api-client'

export interface AdminOverview {
  users: { total: number; appointed: number; unappointed: number }
  runningTotal: number
  overdueTotal: number
  auditToday: number
  lines: Array<{ flow: string; running: number; overdue: number; onTimePct: number }>
  recent: Array<{
    occurredAt: string
    actorSub: string
    actorName: string
    action: string
    code: string | null
    ticketId: string
    flow: string
  }>
  mailPending: number
  pausedTotal: number
  system: { version: string; uptimeSeconds: number }
}

export const getAdminOverview = () => apiGet<AdminOverview>('/admin/overview')

export interface OpenPause {
  ticketId: string
  code: string | null
  status: string
  flow: string
  reason: string
  pausedBySub: string
  pausedByName: string
  pausedAt: string
  pausedDays: number
  stale: boolean
}
export interface StationPauseStat {
  status: string
  pauses: number
  tickets: number
  openNow: number
  longestDays: number
}
export interface SlaPauseReport {
  open: OpenPause[]
  byStation: StationPauseStat[]
  windowDays: number
  staleAfterDays: number
}

export const getSlaPauses = () => apiGet<SlaPauseReport>('/admin/sla-pauses')

export interface DwellCell {
  flow: string
  count: number
  avgDays: number
}
export interface DwellRow {
  status: string
  avgDays: number
  count: number
  cells: DwellCell[]
}
export interface ThroughputBucket {
  period: string
  created: number
  completed: number
}
export interface ReturnStat {
  flow: string
  tickets: number
  returns: number
  ratePct: number
}
export interface OverdueRanked {
  id: string
  code: string | null
  flow: string
  status: string
  overdueDays: number
  holderSub: string | null
}
export interface AnalyticsData {
  granularity: 'week' | 'month'
  flows: string[]
  dwell: DwellRow[]
  throughput: ThroughputBucket[]
  returns: ReturnStat[]
  topOverdue: OverdueRanked[]
}

export const getAnalytics = (granularity: 'week' | 'month') =>
  apiGet<AnalyticsData>(`/admin/analytics?granularity=${granularity}`)

/** Direct download link (same-origin GET behind the session cookie) — used by an
 *  <a download>, not fetch, so the browser saves the file. */
export const analyticsExportUrl = (from?: string, to?: string): string => {
  const p = new URLSearchParams()
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  const qs = p.toString()
  return `/api/admin/analytics/export${qs ? `?${qs}` : ''}`
}

export interface AuditEvent {
  id: string
  occurredAt: string
  actorSub: string
  actorName: string
  action: string
  code: string | null
  ticketId: string
  flow: string
  fromStatus: string
  toStatus: string
  reason: string | null
}
export interface AuditPage {
  events: AuditEvent[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  today: Array<{ action: string; count: number }>
}
export interface AuditQuery {
  code?: string
  sub?: string
  event?: string
  from?: string
  to?: string
  page?: number
}


export interface OptionView {
  id: string
  value: string
  sortOrder: number
  active: boolean
  usedBy: number
}
export const listOptions = (kind: string) => apiGet<OptionView[]>(`/admin/options/${kind}`)
export const createOption = (kind: string, value: string) =>
  apiPost<{ id: string }>(`/admin/options/${kind}`, { value })
/** Thêm document type mới (kèm luồng). */
export const addDocumentType = (value: string, flow: string) =>
  apiPost<{ value: string; flow: string }>('/admin/document-types', { value, flow })

export interface AdminDocType {
  id: string
  value: string
  active: boolean
  /** Số hồ sơ đang dùng — 0 mới xoá hẳn được, >0 chỉ ẩn được. */
  usedBy: number
  /** Hai cờ ga Received by DCC2 — chỉ có nghĩa với loại luồng Contract (bảng ma trận). */
  requiresContractNo: boolean
  allowSkip: boolean
}
export interface AdminDocTypeGroup {
  flow: string
  types: AdminDocType[]
}
/** Danh mục Document Type cho màn Admin: gồm cả loại đã ẩn + số hồ sơ đang dùng. */
export const getAdminDocTypes = () => apiGet<AdminDocTypeGroup[]>('/admin/document-types')
/** Ẩn / bật lại một document type (mềm, hoàn tác được). */
export const setDocTypeActive = (id: string, active: boolean) =>
  apiPatch<{ id: string }>(`/admin/document-types/${id}`, { active })
/** Xoá hẳn — chỉ khi chưa hồ sơ nào dùng (BE chặn usedBy>0). */
export const deleteDocType = (id: string) => apiDelete<{ ok: true }>(`/admin/document-types/${id}`)
/** Bật/tắt hai cờ khả năng (Contract No · Skip) — chỉ loại luồng Contract (bảng ma trận). */
export const setDocTypeCapabilities = (
  id: string,
  patch: { requiresContractNo?: boolean; allowSkip?: boolean },
) => apiPatch<{ id: string }>(`/admin/document-types/${id}/capabilities`, patch)
export const updateOption = (id: string, patch: { value?: string; active?: boolean }) =>
  apiPatch<{ id: string }>(`/admin/options/${id}`, patch)

export const getAuditLog = (q: AuditQuery) => {
  const p = new URLSearchParams()
  if (q.code) p.set('code', q.code)
  if (q.sub) p.set('sub', q.sub)
  if (q.event) p.set('event', q.event)
  if (q.from) p.set('from', q.from)
  if (q.to) p.set('to', q.to)
  if (q.page) p.set('page', String(q.page))
  const qs = p.toString()
  return apiGet<AuditPage>(`/admin/audit${qs ? `?${qs}` : ''}`)
}

export interface UserWithRoles {
  sub: string
  email: string | null
  fullName: string | null
  roles: string[]
  /** True once the person has logged into QLHS at least once (roster tracking). */
  hasAccount?: boolean
}

export const listUsers = () => apiGet<UserWithRoles[]>('/admin/users')

export const setUserRoles = (sub: string, roles: string[]) =>
  apiPut<{ ok: true }>(`/admin/users/${encodeURIComponent(sub)}/roles`, { roles })

export interface SlaConfigRow {
  status: string
  flow: string
  slaDays: number
  updatedBySub: string | null
  updatedAt: string
}

export const getSlaConfig = () => apiGet<SlaConfigRow[]>('/admin/sla-config')

export const updateSla = (flow: string, status: string, slaDays: number) =>
  apiPut<{ ok: true }>(
    `/admin/sla-config/${encodeURIComponent(flow)}/${encodeURIComponent(status)}`,
    { slaDays },
  )

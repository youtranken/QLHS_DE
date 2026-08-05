import { apiGet, apiPost } from '../../shared/api-client'
import type { TicketView } from '../tickets/api'

export interface ClosedFilters {
  code?: string
  contractor?: string
  contractNo?: string
  applicant?: string
  from?: string
  to?: string
}

export interface ClosedPage {
  items: TicketView[]
  nextCursor: string | null
}

/** One page of closed tickets. Pass `cursor` (from a previous page's
 *  `nextCursor`) to fetch the next slice; omit it for the first page. */
export function searchClosed(f: ClosedFilters, cursor?: string): Promise<ClosedPage> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v && v.trim()) qs.set(k, v.trim())
  if (cursor) qs.set('cursor', cursor)
  const suffix = qs.toString() ? `?${qs}` : ''
  return apiGet<ClosedPage>(`/tickets/closed${suffix}`)
}

export const reopenClosed = (id: string, reason: string) =>
  apiPost<{ status: string }>(`/dcc1/tickets/${id}/reopen`, { reason })
export const requestReopen = (id: string) =>
  apiPost<{ ok: true }>(`/dcc/tickets/${id}/request-reopen`)

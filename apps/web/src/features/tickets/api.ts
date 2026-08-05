import { apiGet, apiPatch, apiPost } from '../../shared/api-client'

export interface TicketView {
  id: string
  code: string | null
  status: string
  flow: string
  priority: string
  documentType: string | null
  description: string | null
  contractNo: string | null
  projectTeam: string | null
  paymentTerm: string | null
  budgetCode: string | null
  contractor: string | null
  amount: string | null
  currency: string | null
  currentHolderSub: string | null
  roundNo: number
  createdAt: string
  /** Derived "unseen >24h" signal for the current viewer (AD-18, UX-DR14). */
  unseen?: boolean
}

export interface CreateTicketBody {
  documentType: string
  description: string
  paymentTerm: string
  contractNo: string
  projectTeam: string
  currency: string
  amount: string
  budgetCode: string
  contractor: string
  priority?: string
}

export interface RouteStation {
  status: string
  phase: 'past' | 'now' | 'next'
  holder: string | null
  enteredAt: string | null
}

export interface TimelineEntry {
  action: string
  fromStatus: string
  toStatus: string
  actorSub: string
  occurredAt: string
  reason: string | null
}

export interface PauseEntry {
  pausedAt: string
  resumedAt: string | null
  reason: string
  pausedBySub: string
  status: string
}

export interface TicketDetail {
  id: string
  code: string | null
  status: string
  documentType: string | null
  description: string | null
  paymentTerm: string | null
  contractNo: string | null
  projectTeam: string | null
  budgetCode: string | null
  contractor: string | null
  amount: string | null
  currency: string | null
  roundNo: number
  overdueDays: number
  dwellDays: number
  isClosed: boolean
  /** F8 — clock stopped right now, and why. */
  paused: boolean
  pauseReason: string | null
  route: RouteStation[]
  timeline: TimelineEntry[]
  pauses: PauseEntry[]
  /** sub → display name (AD-12); resolve holder/actor subs through this. */
  directory: Record<string, string>
}

/** Active create-form dropdown values for a kind ('paymentTerm' | 'projectTeam'). */
export const getOptions = (kind: string) => apiGet<string[]>(`/options/${kind}`)

/** Document type gộp theo luồng (admin quản lý ở Danh mục). */
export interface DocTypeGroup {
  flow: string
  types: string[]
}
export const getDocumentTypes = () => apiGet<DocTypeGroup[]>('/options/document-types')

export const listMyTickets = () => apiGet<TicketView[]>('/tickets/mine')
export const createTicket = (body: CreateTicketBody) => apiPost<{ id: string }>('/tickets', body)
export const cancelTicket = (id: string) => apiPost<{ ok: true }>(`/tickets/${id}/cancel`)
export const getTicketDetail = (id: string) => apiGet<TicketDetail>(`/ticket/${id}`)
export const confirmReturnReceipt = (id: string) =>
  apiPost<{ ok: true }>(`/tickets/${id}/confirm-return-receipt`)
export const resubmitTicket = (id: string) => apiPost<{ ok: true }>(`/tickets/${id}/resubmit`)
export const updateFields = (id: string, body: CreateTicketBody) =>
  apiPatch<{ ok: true }>(`/tickets/${id}`, body)

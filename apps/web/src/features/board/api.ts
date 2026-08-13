import { apiGet, apiPatch, apiPost } from '../../shared/api-client'

export interface LegalAction {
  event: string
  label: string
  toStatus: string
  reversible: boolean
  reasonRequired: boolean
}
/** F12 — a suspected duplicate of a Pool ticket, for DCC1 to compare on hover. */
export interface DupHint {
  id: string
  code: string | null
  status: string
  flow: string
  tier: 'strong' | 'medium'
  contractor: string | null
  amount: string | null
  currency: string | null
  ageDays: number
}
export interface BoardCard {
  id: string
  code: string | null
  contractor: string | null
  amount: string | null
  priority: string
  flow: string
  status: string
  /** Round counter (0 = first pass). "Skip to Completed" is offered only on round 0.
   *  Optional on the client: the board always sends it; a synthesized card (detail)
   *  may omit it, in which case skip stays hidden (safe default). */
  roundNo?: number
  overdueDays: number
  lockedByMe: boolean
  lockedBy: string | null
  actions: LegalAction[]
  dupOf?: DupHint[]
  /** F8 — SLA clock stopped ("chờ bổ sung"): the card shows ⏸ and stops ageing. */
  paused?: boolean
  /** F8 — you hold this ticket, so you may stop/restart its clock. */
  mine?: boolean
  /** Reconcile lane only — the reason DCC2/DCC3 gave (missing/wrong paper). */
  reconcileComment?: string | null
}
export interface BoardColumn {
  status: string
  overSla: boolean
  cards: BoardCard[]
  /** DCC1 reconcile lane (2-phase handover bounce) — carries its own label. */
  reconcile?: boolean
  label?: string
}

export const getStationBoard = () => apiGet<BoardColumn[]>('/station-board')
export const pickCard = (id: string) => apiPost<{ ok: true }>(`/dcc1/pool/${id}/pick`)
export const confirmCard = (id: string) =>
  apiPost<{ code: string; status: string }>(`/dcc1/pool/${id}/confirm`)
export const actionCard = (id: string, event: string, reason?: string) =>
  apiPost<{ status: string }>(`/dcc1/tickets/${id}/action`, { event, reason })

/** FR-8 — one action applied to many tickets; each ticket's fate is independent. */
export interface BatchResult {
  id: string
  ok: boolean
  status?: string
  error?: string
}
export const batchAction = (ticketIds: string[], event: string, reason?: string) =>
  apiPost<BatchResult[]>('/dcc1/tickets/action', { ticketIds, event, reason })

/** DCC2 hardcopy bulk — confirm receipt of many, or complete many (Contract close). */
export const batchDcc2Action = (ticketIds: string[], event: string) =>
  apiPost<BatchResult[]>('/dcc2/tickets/action', { ticketIds, event })

/** DCC3 hardcopy bulk — confirm receipt of many (Payment; no complete step). */
export const batchDcc3Action = (ticketIds: string[], event: string) =>
  apiPost<BatchResult[]>('/dcc3/tickets/action', { ticketIds, event })

/** FR-1 — DCC1 re-prioritises a ticket in ANY state (audited server-side). */
export const changePriority = (id: string, priority: string) =>
  apiPatch<{ ok: true }>(`/dcc1/tickets/${id}/priority`, { priority })
export const seizeCard = (id: string) =>
  apiPost<{ acquired: boolean }>(`/dcc1/tickets/${id}/seize`)
export const undoCard = (id: string) => apiPost<{ status: string }>(`/dcc1/tickets/${id}/undo`)

// F8 — stop/restart the SLA clock. Holder-only; the server enforces it.
export const pauseSla = (id: string, reason: string) =>
  apiPost<{ ok: true }>(`/ticket/${id}/sla-pause`, { reason })
export const resumeSla = (id: string) => apiPost<{ ok: true }>(`/ticket/${id}/sla-resume`)

// Story 3.1 — 2-phase handover DCC1↔DCC2
export const receiveDcc2 = (id: string, receivedAt?: string) =>
  apiPost<{ status: string }>(`/dcc2/tickets/${id}/receive`, receivedAt ? { receivedAt } : {})
export const missingPaperDcc2 = (id: string, reason?: string) =>
  apiPost<{ ok: true }>(`/dcc2/tickets/${id}/missing-paper`, reason ? { reason } : {})
export const resendDcc2 = (id: string) =>
  apiPost<{ ok: true }>(`/dcc1/tickets/${id}/resend-dcc2`)
export const sendAccounting = (id: string, documentNo: string) =>
  apiPost<{ status: string }>(`/dcc2/tickets/${id}/send-accounting`, { documentNo })
/** Batch pre-flight: which of these numbers are already taken (live tickets),
 *  scoped to the flow entering them (Contract → contract_no, Payment → payment_no). */
export const checkDocumentNos = (documentNos: string[], flow: string) =>
  apiPost<{ existing: string[] }>('/tickets/check-document-nos', { documentNos, flow })
export const receiveFromAcc = (id: string, receivedAt?: string) =>
  apiPost<{ status: string }>(
    `/dcc1/tickets/${id}/receive-from-acc`,
    receivedAt ? { receivedAt } : {},
  )
export const completeContract = (id: string) =>
  apiPost<{ status: string }>(`/dcc2/tickets/${id}/complete`)
/** DCC2 "Skip Completed" (Contract): fast-forward straight to Completed, running
 *  ACC + BOP steps server-side. Contract No optional — blank stores N/A. */
export const skipToCompleted = (id: string, documentNo?: string) =>
  apiPost<{ status: string }>(
    `/dcc2/tickets/${id}/skip-to-completed`,
    documentNo ? { documentNo } : {},
  )
export const returnPushback = (id: string, reason: string) =>
  apiPost<{ status: string }>(`/dcc1/tickets/${id}/return-pushback`, { reason })

// Story 4.1 — 2-phase handover DCC1→DCC3 (Payment)
export const receiveDcc3 = (id: string, receivedAt?: string) =>
  apiPost<{ status: string }>(`/dcc3/tickets/${id}/receive`, receivedAt ? { receivedAt } : {})
export const missingPaperDcc3 = (id: string, reason?: string) =>
  apiPost<{ ok: true }>(`/dcc3/tickets/${id}/missing-paper`, reason ? { reason } : {})
export const resendDcc3 = (id: string) =>
  apiPost<{ ok: true }>(`/dcc1/tickets/${id}/resend-dcc3`)
export const sendAccountingDcc3 = (id: string, documentNo: string) =>
  apiPost<{ status: string }>(`/dcc3/tickets/${id}/send-accounting`, { documentNo })

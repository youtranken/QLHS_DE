import { FLOW, TICKET_STATUS, type Flow, type TicketStatus } from '@qlhs/contracts'

/**
 * The expected happy-path station route per flow (FR-18) — drawn in full from
 * submit so the Applicant sees where a ticket is headed, not only where it has
 * been. Detours (BOP, Return) are conditional; BOP is inserted when reached.
 */
const BASE_ROUTE: Record<Flow, TicketStatus[]> = {
  [FLOW.General]: [
    TICKET_STATUS.Submitted,
    TICKET_STATUS.SubmittedToVpAndy,
    TICKET_STATUS.Completed,
  ],
  [FLOW.Contract]: [
    TICKET_STATUS.Submitted,
    TICKET_STATUS.SubmittedToVpAndy,
    TICKET_STATUS.SubmittedToDcc2,
    TICKET_STATUS.ReceivedByDcc2,
    TICKET_STATUS.SubmittedToAccounting,
    TICKET_STATUS.ReceivedFromAcc,
    TICKET_STATUS.SubmittedToBop,
    TICKET_STATUS.SubmittedToDcc2Hardcopy,
    TICKET_STATUS.Hardcopy,
    TICKET_STATUS.Completed,
  ],
  // Payment closes at `Sent to Accounting` (H5), but the map/route show a single
  // `Completed` finish — the real terminal status is folded into it via
  // displayStation(), so there's ONE green end station, not two. State machine
  // unchanged (no ticket ever holds `Completed` status in Payment).
  [FLOW.Payment]: [
    TICKET_STATUS.Submitted,
    TICKET_STATUS.SubmittedToVpAndy,
    TICKET_STATUS.SubmittedToDcc3,
    TICKET_STATUS.ReceivedByDcc3,
    TICKET_STATUS.Completed,
  ],
}

/**
 * The station a ticket's real status is DISPLAYED under on the route/map. Payment
 * has no `Completed` status — it closes at `Sent to Accounting` (H5) — so those
 * closed tickets are shown at the unified `Completed` finish rather than a second
 * green terminal. Every other status displays as itself.
 */
export function displayStation(flow: Flow, status: TicketStatus): TicketStatus {
  if (flow === FLOW.Payment && status === TICKET_STATUS.SentToAccounting) {
    return TICKET_STATUS.Completed
  }
  return status
}

export type RoutePhase = 'past' | 'now' | 'next'

export interface RouteStation {
  status: TicketStatus
  phase: RoutePhase
}

/** Stations shown on the dispatch map for a flow (General includes the BOP detour). */
export function flowStations(flow: Flow): TicketStatus[] {
  if (flow === FLOW.General) {
    return [
      TICKET_STATUS.Submitted,
      TICKET_STATUS.SubmittedToVpAndy,
      TICKET_STATUS.SubmittedToBop,
      TICKET_STATUS.Completed,
    ]
  }
  return [...BASE_ROUTE[flow]]
}

export function projectedRoute(flow: Flow, current: TicketStatus): RouteStation[] {
  const route = [...BASE_ROUTE[flow]]
  if (flow === FLOW.General && current === TICKET_STATUS.SubmittedToBop) {
    route.splice(route.indexOf(TICKET_STATUS.Completed), 0, TICKET_STATUS.SubmittedToBop)
  }
  // Payment at `Sent to Accounting` lands on the unified Completed finish (H5).
  const target = displayStation(flow, current)
  const idx = route.indexOf(target)
  return route.map((status, i) => ({
    status,
    phase: idx < 0 ? 'next' : i < idx ? 'past' : i === idx ? 'now' : 'next',
  }))
}

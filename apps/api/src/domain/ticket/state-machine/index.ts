import type { Flow, Role, TicketEvent, TicketStatus } from '@qlhs/contracts'
import type { Edge } from './types'
import { SHARED_EDGES } from './shared'
import { GENERAL_EDGES } from './general'
import { CONTRACT_EDGES } from './contract'
import { PAYMENT_EDGES } from './payment'

export type { Edge } from './types'

/** The single, closed set of edges (AD-3), composed from the per-flow modules. */
export const EDGES: readonly Edge[] = [
  ...SHARED_EDGES,
  ...GENERAL_EDGES,
  ...CONTRACT_EDGES,
  ...PAYMENT_EDGES,
]

/**
 * Resolve the edge for (from, event) in a flow. Flow-specific edges win over the
 * shared `'*'` fallback, so the same event can route differently per flow (B1).
 */
export function findEdge(
  from: TicketStatus,
  event: TicketEvent,
  flow: Flow,
): Edge | undefined {
  return (
    EDGES.find((e) => e.from === from && e.event === event && e.flow === flow) ??
    EDGES.find((e) => e.from === from && e.event === event && e.flow === '*')
  )
}

/** Events a role may fire from a status in a flow (basis for AD-17 actionbar). */
export function legalActions(from: TicketStatus, role: Role, flow: Flow): TicketEvent[] {
  const events = EDGES.filter(
    (e) => e.from === from && e.ownerRole === role && (e.flow === flow || e.flow === '*'),
  ).map((e) => e.event)
  return [...new Set(events)]
}

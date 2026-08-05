import type { Flow, Role, TicketEvent, TicketStatus } from '@qlhs/contracts'

/** `'*'` = edge applies to every flow (shared); otherwise flow-specific. */
export type FlowScope = Flow | '*'

/**
 * A declarative state-machine edge (AD-3). The engine holds only keys — SLA day
 * numbers live in sla_config keyed by (status, flow), read at query time (AD-6).
 */
export interface Edge {
  from: TicketStatus
  event: TicketEvent
  to: TicketStatus
  /** Role permitted to perform this transition (checked against activeRole, H3). */
  ownerRole: Role
  flow: FlowScope
  /** Whether an Undo compensating transition is allowed (AD-19). */
  reversible: boolean
  /**
   * True only on a `sendBack` from a state past external processing (ACC /
   * DCC2-3 / BOP-after-ACC). Such a Return counts a new round; light bounces
   * (wrong type, Andy/BOP-General reject before ACC) do not (AD-11, PRD §6).
   */
  enteredFlow?: boolean
}

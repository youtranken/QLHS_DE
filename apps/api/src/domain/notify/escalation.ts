import { ROLE, TICKET_STATUS, type Role, type TicketStatus } from '@qlhs/contracts'
import { stateOwner } from '../ticket/state-machine/state-owner'

export const ESCALATION_KIND = {
  Warn: 'EscalateWarn',
  Overdue: 'EscalateOverdue',
  Critical: 'EscalateCritical',
} as const

export type EscalationKind = (typeof ESCALATION_KIND)[keyof typeof ESCALATION_KIND]

export interface EscalationConfig {
  /** Nudge the holder this many business days before the threshold bites. */
  warnDays: number
  /** Overdue by ≥ this many business days → escalate to management (Admin). */
  criticalOverdueDays: number
}

/**
 * The role responsible for a station, even before anyone picks the ticket up
 * (Pool → DCC1). Applicant-owned or terminal → null: the escalation ladder is the
 * DCC→Admin chain, and an Applicant sitting on a Return is chased by the Return
 * reminder instead.
 */
export function stationRole(status: string): Role | null {
  if (status === TICKET_STATUS.Submitted) return ROLE.Dcc1
  const owner = stateOwner(status as TicketStatus)
  return owner === null || owner === ROLE.Applicant ? null : owner
}

export interface EscalationTicket {
  status: string
  overdueDays: number
  daysLeft: number
  holderSub: string | null
}

export interface EscalationIntent {
  kind: EscalationKind
  recipientSub: string | null
  recipientRole: Role | null
  /** The station the escalation is about — lets the read side auto-resolve it the
   *  moment the ticket moves on (same mechanism as a 2.2 role notification). */
  waitingStatus: string
}

/**
 * The SLA escalation ladder (2.5): as a DCC-owned ticket ages it climbs from a
 * private nudge to the holder → the whole station role (so a peer — or whoever
 * covers an absent holder — can step in) → management (Admin). Pure: the scheduler
 * feeds pause-adjusted numbers and persists whatever intent comes back, at most
 * once per tier per station.
 */
export function escalationIntent(t: EscalationTicket, cfg: EscalationConfig): EscalationIntent | null {
  const role = stationRole(t.status)
  if (role === null) return null

  if (t.overdueDays >= cfg.criticalOverdueDays) {
    return { kind: ESCALATION_KIND.Critical, recipientSub: null, recipientRole: ROLE.Admin, waitingStatus: t.status }
  }
  if (t.overdueDays > 0) {
    return { kind: ESCALATION_KIND.Overdue, recipientSub: null, recipientRole: role, waitingStatus: t.status }
  }
  if (t.daysLeft <= cfg.warnDays) {
    // A held ticket gets a private nudge; an unclaimed inbox ticket goes to the role.
    return t.holderSub
      ? { kind: ESCALATION_KIND.Warn, recipientSub: t.holderSub, recipientRole: null, waitingStatus: t.status }
      : { kind: ESCALATION_KIND.Warn, recipientSub: null, recipientRole: role, waitingStatus: t.status }
  }
  return null
}

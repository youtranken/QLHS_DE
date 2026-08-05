import { TICKET_EVENT, type TicketEvent, type TicketStatus } from '@qlhs/contracts'
import { findEdge } from './state-machine/index'
import {
  deriveHolder,
  ForbiddenTransitionError,
  type Actor,
  type TicketState,
  type TransitionOutput,
} from './transition'
import { DomainError } from '../errors'
import type { TicketEventRecord } from '../audit/ticket-event'

export class NotReversibleError extends DomainError {
  readonly code = 'NotReversible'
}

/** The just-performed forward move being undone (AD-19). */
export interface UndoTarget {
  action: TicketEvent
  fromStatus: TicketStatus
  occurredAt: Date
  /** When the ticket originally entered `fromStatus`. Undo restores this so the
   *  restored station's SLA clock is handed back, not restarted — a forward-then-
   *  undo bounce must not shed an about-to-fire overdue badge. Absent (e.g. the
   *  station was the flow's entry) → fall back to `now`. */
  priorStatusEnteredAt?: Date
}

/**
 * Undo = a COMPENSATING transition (AD-19), never a mutation of past audit
 * (AD-4). It only reverses the most recent forward move and only if that move's
 * edge is `reversible`; it appends a fresh `undo` event carrying the ticket back
 * to the prior status. Irreversible edges (Completed, thiếu-giấy, Reopen) throw.
 */
export function undoTransition(
  ticket: TicketState,
  target: UndoTarget,
  actor: Actor,
  now: Date,
): TransitionOutput {
  const edge = findEdge(target.fromStatus, target.action, ticket.flow)
  if (!edge || !edge.reversible) {
    throw new NotReversibleError(`Action ${target.action} is not reversible`)
  }
  // Only the role that owns the forward edge may reverse it — same authority check
  // transition() applies. Safe-by-coincidence today (all reversible edges are DCC1);
  // pinned so a future DCC2/DCC3 reversible edge can't be undone by the wrong role.
  if (edge.ownerRole !== actor.activeRole) {
    throw new ForbiddenTransitionError(
      `Role ${actor.activeRole} may not undo ${target.action}`,
    )
  }
  // Guard against undoing a stale move: the ticket must still sit where that
  // forward edge left it, or a later transition already moved on.
  if (ticket.status !== edge.to) {
    throw new NotReversibleError('Ticket already moved on — nothing to undo')
  }

  const toStatus = target.fromStatus
  const nextTicket: TicketState = {
    ...ticket,
    status: toStatus,
    currentHolderSub: deriveHolder(toStatus, ticket.applicantSub, actor),
    statusEnteredAt: target.priorStatusEnteredAt ?? now,
  }
  // roundNo is unchanged on undo: no reversible edge is `enteredFlow`, so the
  // forward move never bumped it and there is nothing to roll back.
  const event: TicketEventRecord = {
    ticketId: ticket.id,
    actorSub: actor.sub,
    action: TICKET_EVENT.Undo,
    fromStatus: ticket.status,
    toStatus,
    roundNo: ticket.roundNo,
    occurredAt: now,
    meta: { undoneAction: target.action },
  }
  return { ticket: nextTicket, event }
}

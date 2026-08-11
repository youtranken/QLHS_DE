import { isTerminal, ROLE, type Flow, type Role, type TicketEvent, type TicketStatus } from '@qlhs/contracts'
import { findEdge } from './state-machine/index'
import { stateOwner } from './state-machine/state-owner'
import { DomainError } from '../errors'
import type { TicketEventRecord } from '../audit/ticket-event'

export interface TicketState {
  id: string
  status: TicketStatus
  flow: Flow
  applicantSub: string
  currentHolderSub: string | null
  roundNo: number
  statusEnteredAt: Date
}

export interface Actor {
  sub: string
  activeRole: Role
}

export interface TransitionInput {
  event: TicketEvent
  actor: Actor
  now: Date
  reason?: string
  meta?: Record<string, unknown>
}

export interface TransitionOutput {
  ticket: TicketState
  event: TicketEventRecord
}

export class IllegalTransitionError extends DomainError {
  readonly code = 'IllegalTransition'
}
export class ForbiddenTransitionError extends DomainError {
  readonly code = 'ForbiddenTransition'
}
export class ReasonRequiredError extends DomainError {
  readonly code = 'ReasonRequired'
}

// sendBack always needs a reason; submitToBop carries DCC1's mandatory note to BOP
// (enforced server-side, not just in the UI, so the handover log always has it).
const REASON_REQUIRED: ReadonlySet<TicketEvent> = new Set<TicketEvent>(['sendBack', 'submitToBop'])

/**
 * The ONLY place ticket.status changes (AD-2). Pure: validates the edge against
 * (status, event, flow) and the actor's activeRole, derives to-status +
 * current_holder_sub + round_no + status_entered_at, and produces exactly one
 * audit record. The application layer persists this inside one FOR-UPDATE
 * transaction (AD-14); on any failure it rolls back — never a status change
 * without its audit row.
 */
export function transition(ticket: TicketState, input: TransitionInput): TransitionOutput {
  const edge = findEdge(ticket.status, input.event, ticket.flow)
  if (!edge) {
    throw new IllegalTransitionError(
      `No edge: ${ticket.status} --${input.event}--> (flow ${ticket.flow})`,
    )
  }
  if (edge.ownerRole !== input.actor.activeRole) {
    throw new ForbiddenTransitionError(
      `Role ${input.actor.activeRole} may not ${input.event} from ${ticket.status}`,
    )
  }
  if (REASON_REQUIRED.has(input.event) && !input.reason?.trim()) {
    throw new ReasonRequiredError(`Event ${input.event} requires a reason`)
  }

  const toStatus = edge.to
  const roundNo = edge.enteredFlow ? ticket.roundNo + 1 : ticket.roundNo
  const currentHolderSub = deriveHolder(toStatus, ticket.applicantSub, input.actor)
  const reason = input.reason?.trim() ? input.reason.trim() : undefined

  const nextTicket: TicketState = {
    ...ticket,
    status: toStatus,
    currentHolderSub,
    roundNo,
    statusEnteredAt: input.now,
  }

  const event: TicketEventRecord = {
    ticketId: ticket.id,
    actorSub: input.actor.sub,
    action: input.event,
    fromStatus: ticket.status,
    toStatus,
    reason,
    roundNo,
    occurredAt: input.now,
    meta: input.meta,
  }

  return { ticket: nextTicket, event }
}

/** current_holder_sub as a function of the to-status (never a UI flag, AD-2). */
export function deriveHolder(to: TicketStatus, applicantSub: string, actor: Actor): string | null {
  if (isTerminal(to)) return null
  const owner = stateOwner(to)
  if (owner === null) return null // Pool / unassigned
  if (owner === ROLE.Applicant) return applicantSub
  // DCC-owned: the performer holds it only if they own this state. A handoff to
  // another role's inbox (DCC1 → `Submitted to DCC2`) has NO holder until the
  // receiver confirms receipt — the two-phase handover waiting state (AD-10).
  return owner === actor.activeRole ? actor.sub : null
}

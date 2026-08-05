import { Injectable } from '@nestjs/common'
import type { TicketEvent, TicketStatus } from '@qlhs/contracts'
import { undoTransition, NotReversibleError } from '../../domain/ticket/undo'
import type { Actor, TicketState } from '../../domain/ticket/transition'
import { TicketTransitionRepo } from '../../infra/prisma/ticket/ticket-transition.repo'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { TicketNotFoundError } from '../../domain/errors'

/** Undo window (AD-19 / UX-DR15): the 5-second toast affordance. */
const UNDO_WINDOW_MS = 5000

/**
 * Undo the most recent action within a 5s window (AD-19). Delegates the
 * reversibility rules to the domain; the compensating move is applied as a fresh
 * append-only transition — past audit is never touched (AD-4).
 */
@Injectable()
export class UndoActionUseCase {
  constructor(
    private readonly transitions: TicketTransitionRepo,
    private readonly tickets: TicketQueryRepo,
    private readonly clock: SystemClock,
  ) {}

  async execute(req: { ticketId: string; actor: Actor }): Promise<TicketState> {
    const last = await this.tickets.lastTransitionEvent(req.ticketId)
    if (!last) throw new TicketNotFoundError(req.ticketId)
    const now = this.clock.now()
    if (now.getTime() - last.occurredAt.getTime() > UNDO_WINDOW_MS) {
      throw new NotReversibleError('Quá thời hạn hoàn tác (5 giây)')
    }
    // Entry time of the station being restored = when the ticket last landed on
    // `last.fromStatus`, so undo hands the SLA clock back instead of restarting it.
    const timeline = await this.tickets.timeline(req.ticketId)
    const priorStatusEnteredAt = timeline
      .filter((e) => e.toStatus === last.fromStatus && e.occurredAt.getTime() < last.occurredAt.getTime())
      .reduce<Date | undefined>((acc, e) => (!acc || e.occurredAt > acc ? e.occurredAt : acc), undefined)
    const target = {
      action: last.action as TicketEvent,
      fromStatus: last.fromStatus as TicketStatus,
      occurredAt: last.occurredAt,
      priorStatusEnteredAt,
    }
    return this.transitions.apply(req.ticketId, (s) => undoTransition(s, target, req.actor, now))
  }
}

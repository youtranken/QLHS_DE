import { Injectable } from '@nestjs/common'
import type { TicketEvent } from '@qlhs/contracts'
import { transition, type Actor, type TicketState } from '../../domain/ticket/transition'
import { TicketTransitionRepo } from '../../infra/prisma/ticket/ticket-transition.repo'
import { SystemClock } from '../../infra/clock/system-clock'

export interface TransitionRequest {
  ticketId: string
  event: TicketEvent
  actor: Actor
  reason?: string
  meta?: Record<string, unknown>
}

/**
 * The one entry point later stories call to change a ticket's status. Injects
 * the clock, delegates the atomic transaction to the repo, and lets the pure
 * domain `transition()` decide the outcome.
 */
@Injectable()
export class TransitionTicketUseCase {
  constructor(
    private readonly repo: TicketTransitionRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: TransitionRequest): Promise<TicketState> {
    const now = this.clock.now()
    return this.repo.apply(req.ticketId, (state) =>
      transition(state, {
        event: req.event,
        actor: req.actor,
        now,
        reason: req.reason,
        meta: req.meta,
      }),
    )
  }
}

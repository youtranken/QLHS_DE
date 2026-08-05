import { Injectable } from '@nestjs/common'
import { TICKET_EVENT } from '@qlhs/contracts'
import { transition, type Actor, type TicketState } from '../../domain/ticket/transition'
import { TicketTransitionRepo } from '../../infra/prisma/ticket/ticket-transition.repo'
import { SystemClock } from '../../infra/clock/system-clock'

/**
 * DCC1 reopens a closed ticket (FR-17, no time limit): `Completed → Reopened →
 * Returned` for a fresh round — as one atomic chain (AD-2/AD-14). Code + data +
 * timeline are preserved; the round is counted (reopen is a heavy path).
 */
@Injectable()
export class ReopenTicketUseCase {
  constructor(
    private readonly repo: TicketTransitionRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actor: Actor; reason: string }): Promise<TicketState> {
    const now = this.clock.now()
    // Distinct timestamps so the two chained events order deterministically in the
    // timeline (reopen before sendBack) and lastTransitionEvent picks the sendBack.
    const then = new Date(now.getTime() + 1)
    return this.repo.applyChain(req.ticketId, [
      (s) => transition(s, { event: TICKET_EVENT.Reopen, actor: req.actor, now }),
      (s) => transition(s, { event: TICKET_EVENT.SendBack, actor: req.actor, now: then, reason: req.reason }),
    ])
  }
}

import { Injectable } from '@nestjs/common'
import { ROLE, TICKET_EVENT } from '@qlhs/contracts'
import { transition, type TicketState } from '../../domain/ticket/transition'
import { TicketTransitionRepo } from '../../infra/prisma/ticket/ticket-transition.repo'
import { SystemClock } from '../../infra/clock/system-clock'

/** DCC1 takes the hardcopy back from ACC (FR-12, AD-10 reverse handover). Records
 *  the receipt date in the audit meta; owns the ticket at `Received from ACC`. */
@Injectable()
export class ReceiveFromAccUseCase {
  constructor(
    private readonly repo: TicketTransitionRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actorSub: string; receivedAt?: Date }): Promise<TicketState> {
    const now = this.clock.now()
    return this.repo.apply(req.ticketId, (state) =>
      transition(state, {
        event: TICKET_EVENT.ReceiveFromAcc,
        actor: { sub: req.actorSub, activeRole: ROLE.Dcc1 },
        now,
        meta: { receivedFromAccAt: (req.receivedAt ?? now).toISOString() },
      }),
    )
  }
}

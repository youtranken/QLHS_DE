import { Injectable } from '@nestjs/common'
import { ROLE, TICKET_EVENT } from '@qlhs/contracts'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'
import { SystemClock } from '../../infra/clock/system-clock'

/**
 * Phase 2 of the DCC1→DCC3 handover (Story 4.1, AC2): DCC3 confirms the physical
 * hardcopy is in hand, recording the receipt date. Reuses the locked, reconcile-
 * aware `confirmReceived` — refused while flagged for reconciliation (missing
 * paper), that lane belongs to DCC1.
 */
@Injectable()
export class ConfirmReceivedByDcc3UseCase {
  constructor(
    private readonly repo: HandoverRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actorSub: string; receivedAt?: Date }): Promise<{ status: string }> {
    const now = this.clock.now()
    return this.repo.confirmReceived(
      req.ticketId,
      { sub: req.actorSub, activeRole: ROLE.Dcc3 },
      TICKET_EVENT.ConfirmReceivedByDcc3,
      req.receivedAt ?? now,
      now,
    )
  }
}

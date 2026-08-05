import { Injectable } from '@nestjs/common'
import { ROLE, TICKET_EVENT } from '@qlhs/contracts'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'
import { SystemClock } from '../../infra/clock/system-clock'

/**
 * Phase 2 of the DCC1→DCC2 handover (AC2): DCC2 confirms the physical hardcopy is
 * in hand, recording the receipt date in the audit meta. The repo runs the
 * reconcile-flag check and the transition in one locked transaction — refused
 * while flagged for reconciliation (missing paper), that lane belongs to DCC1.
 */
@Injectable()
export class ConfirmReceivedByDcc2UseCase {
  constructor(
    private readonly repo: HandoverRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actorSub: string; receivedAt?: Date }): Promise<{ status: string }> {
    const now = this.clock.now()
    return this.repo.confirmReceived(
      req.ticketId,
      { sub: req.actorSub, activeRole: ROLE.Dcc2 },
      TICKET_EVENT.ConfirmReceivedByDcc2,
      req.receivedAt ?? now,
      now,
    )
  }
}

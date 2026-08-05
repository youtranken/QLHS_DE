import { Injectable } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { ReasonRequiredError } from '../../domain/ticket/transition'

/** DCC1 resolves a DCC2 push-back (AC4): clears the reconcile flag and runs the
 *  heavy Return in one transaction. DCC1 is the sole Return actor (AD-11). */
@Injectable()
export class ReturnFromPushbackUseCase {
  constructor(
    private readonly repo: HandoverRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actorSub: string; reason: string }): Promise<{ status: string }> {
    const reason = req.reason?.trim()
    if (!reason) throw new ReasonRequiredError('Trả lại cần lý do')
    return this.repo.returnFromPushback(
      req.ticketId,
      { sub: req.actorSub, activeRole: ROLE.Dcc1 },
      reason,
      this.clock.now(),
    )
  }
}

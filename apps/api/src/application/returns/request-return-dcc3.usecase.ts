import { Injectable } from '@nestjs/common'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'

/** DCC3 "đẩy ngược DCC1" (H2, AD-11): a push-back note asking DCC1 to Return a
 *  wrong Payment hardcopy from `Received by DCC3`. DCC3 never Returns itself. */
@Injectable()
export class RequestReturnDcc3UseCase {
  constructor(private readonly repo: HandoverRepo) {}

  execute(req: { ticketId: string; actorSub: string }): Promise<void> {
    return this.repo.requestReturnDcc3(req.ticketId, req.actorSub)
  }
}

import { Injectable } from '@nestjs/common'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'

/** DCC2 "đẩy ngược DCC1" (AC4, AD-11): a push-back note asking DCC1 to Return a
 *  wrong hardcopy. DCC2/DCC3 never Return themselves; DCC1 executes the sendBack. */
@Injectable()
export class RequestReturnUseCase {
  constructor(private readonly repo: HandoverRepo) {}

  execute(req: { ticketId: string; actorSub: string; reason?: string }): Promise<void> {
    return this.repo.requestReturn(req.ticketId, req.actorSub, req.reason)
  }
}

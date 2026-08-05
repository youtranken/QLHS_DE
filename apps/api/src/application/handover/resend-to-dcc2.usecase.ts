import { Injectable } from '@nestjs/common'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'

/** DCC1 re-hands over a reconciled ticket → clears the missing-paper flag so DCC2
 *  can re-confirm receipt (AC4). Status is unchanged (`Submitted to DCC2`). */
@Injectable()
export class ResendToDcc2UseCase {
  constructor(private readonly repo: HandoverRepo) {}

  execute(req: { ticketId: string; actorSub: string }): Promise<void> {
    return this.repo.clearMissingPaper(req.ticketId, req.actorSub)
  }
}

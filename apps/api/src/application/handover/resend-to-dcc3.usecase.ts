import { Injectable } from '@nestjs/common'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'

/** DCC1 re-hands over a reconciled Payment ticket → clears the missing-paper flag
 *  so DCC3 can re-confirm receipt (Story 4.1). Status stays `Submitted to DCC3`. */
@Injectable()
export class ResendToDcc3UseCase {
  constructor(private readonly repo: HandoverRepo) {}

  execute(req: { ticketId: string; actorSub: string }): Promise<void> {
    return this.repo.clearMissingPaperDcc3(req.ticketId, req.actorSub)
  }
}

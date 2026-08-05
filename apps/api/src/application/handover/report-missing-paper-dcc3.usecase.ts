import { Injectable } from '@nestjs/common'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'

/** DCC3 reports a missing hardcopy on a `Submitted to DCC3` ticket (Story 4.1,
 *  AC3). The ticket stays put and bounces to DCC1's reconcile lane (B6). */
@Injectable()
export class ReportMissingPaperDcc3UseCase {
  constructor(private readonly repo: HandoverRepo) {}

  execute(req: { ticketId: string; actorSub: string }): Promise<void> {
    return this.repo.flagMissingPaperDcc3(req.ticketId, req.actorSub)
  }
}

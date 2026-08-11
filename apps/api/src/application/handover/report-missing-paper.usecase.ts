import { Injectable } from '@nestjs/common'
import { HandoverRepo } from '../../infra/prisma/ticket/handover.repo'

/** DCC2 reports a missing hardcopy on a `Submitted to DCC2` ticket (AC3). The
 *  ticket stays put and bounces to DCC1's reconcile queue; irreversible (B6). */
@Injectable()
export class ReportMissingPaperUseCase {
  constructor(private readonly repo: HandoverRepo) {}

  execute(req: { ticketId: string; actorSub: string; reason?: string }): Promise<void> {
    return this.repo.flagMissingPaper(req.ticketId, req.actorSub, req.reason)
  }
}

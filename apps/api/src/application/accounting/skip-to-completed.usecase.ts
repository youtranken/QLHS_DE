import { Injectable } from '@nestjs/common'
import { SkipToCompletedRepo } from '../../infra/prisma/ticket/skip-to-completed.repo'
import { SystemClock } from '../../infra/clock/system-clock'

/** DCC2 "Skip Completed": fast-forward a Contract from `Received by DCC2` to
 *  `Completed` in one atomic chain (repo). Contract No is optional here — "nhập
 *  nếu có, không thì N/A" — and 'N/A' is excluded from the unique index, so a
 *  skipped ticket can close without a real number. */
@Injectable()
export class SkipToCompletedUseCase {
  constructor(
    private readonly repo: SkipToCompletedRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: {
    ticketId: string
    actorSub: string
    documentNo?: string
  }): Promise<{ status: string }> {
    const trimmed = req.documentNo?.trim()
    const documentNo = trimmed ? trimmed : 'N/A'
    return this.repo.skip(req.ticketId, req.actorSub, documentNo, this.clock.now())
  }
}

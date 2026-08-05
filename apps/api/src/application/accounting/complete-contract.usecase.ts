import { Injectable } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { CompleteContractRepo } from '../../infra/prisma/ticket/complete-contract.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { ScanPathRequiredError } from '../core/ticket-errors'

/** DCC2 closes a Contract at Hardcopy: records the scan path and completes (FR-12).
 *  The Applicant email intent is written transactionally (AD-15); irreversible. */
@Injectable()
export class CompleteContractUseCase {
  constructor(
    private readonly repo: CompleteContractRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actorSub: string; scanPath: string }): Promise<{ status: string }> {
    const scanPath = req.scanPath.trim()
    if (!scanPath) throw new ScanPathRequiredError('Cần nhập đường dẫn file scan trước khi hoàn tất')
    return this.repo.complete(
      req.ticketId,
      { sub: req.actorSub, activeRole: ROLE.Dcc2 },
      scanPath,
      this.clock.now(),
    )
  }
}

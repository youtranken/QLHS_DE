import { Injectable } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { CompleteContractRepo } from '../../infra/prisma/ticket/complete-contract.repo'
import { SystemClock } from '../../infra/clock/system-clock'

/** DCC2 closes a Contract at Hardcopy: confirming completes it and writes the
 *  Applicant email intent transactionally (AD-15); irreversible. DCC2 does its own
 *  scanning out-of-band — no scan path is collected here anymore. */
@Injectable()
export class CompleteContractUseCase {
  constructor(
    private readonly repo: CompleteContractRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actorSub: string }): Promise<{ status: string }> {
    return this.repo.complete(
      req.ticketId,
      { sub: req.actorSub, activeRole: ROLE.Dcc2 },
      this.clock.now(),
    )
  }
}

import { Injectable } from '@nestjs/common'
import { ConfirmFlowRepo } from '../../infra/prisma/ticket/confirm-flow.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import type { Actor } from '../../domain/ticket/transition'

/**
 * DCC1 confirms the flow: mints the code (if not yet minted) and moves the
 * ticket Submitted → Submitted to VP Andy — one atomic step.
 */
@Injectable()
export class ConfirmFlowUseCase {
  constructor(
    private readonly repo: ConfirmFlowRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actor: Actor }): Promise<{ code: string; status: string }> {
    return this.repo.confirm(req.ticketId, req.actor, this.clock.now())
  }
}

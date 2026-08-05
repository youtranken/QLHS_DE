import { Injectable } from '@nestjs/common'
import type { Priority } from '@qlhs/contracts'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'

/**
 * M6: DCC1 may re-prioritise a ticket in ANY state (not only Pool). Audited via
 * priority_changed (B6) — no silent column write.
 */
@Injectable()
export class DccAdjustPriorityUseCase {
  constructor(private readonly repo: TicketWriteRepo) {}

  execute(req: { ticketId: string; actorSub: string; priority: Priority }): Promise<void> {
    return this.repo.changePriorityAnyState(req.ticketId, req.actorSub, req.priority)
  }
}

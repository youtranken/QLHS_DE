import { Injectable } from '@nestjs/common'
import type { Role } from '@qlhs/contracts'
import { roleFlows } from '../../domain/dispatch/role-flows'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'

/**
 * DCC2/DCC3 "Đề nghị Reopen" (FR-17): records a `reopen_requested` audit note
 * (B6) flagging DCC1 — it never changes status, since only DCC1 reopens. The
 * caller's role fixes the flow scope (AD-16), enforced in the repo.
 */
@Injectable()
export class RequestReopenUseCase {
  constructor(private readonly repo: TicketWriteRepo) {}

  execute(req: { ticketId: string; actorSub: string; role: Role | null }): Promise<void> {
    return this.repo.writeReopenRequest(req.ticketId, req.actorSub, roleFlows(req.role))
  }
}

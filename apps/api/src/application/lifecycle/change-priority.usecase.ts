import { Injectable } from '@nestjs/common'
import type { Priority } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'
import { NotTicketOwnerError } from '../core/ticket-errors'
import { TicketNotFoundError } from '../../domain/errors'

export interface ChangePriorityRequest {
  ticketId: string
  actorSub: string
  priority: Priority
}

@Injectable()
export class ChangePriorityUseCase {
  constructor(
    private readonly repo: TicketQueryRepo,
    private readonly writes: TicketWriteRepo,
  ) {}

  async execute(req: ChangePriorityRequest): Promise<void> {
    const ticket = await this.repo.findByIdForApplicant(req.ticketId, req.actorSub)
    if (!ticket) throw new TicketNotFoundError(req.ticketId)
    if (ticket.applicantSub !== req.actorSub) throw new NotTicketOwnerError()
    await this.writes.changePriority(req.ticketId, req.actorSub, req.priority)
  }
}

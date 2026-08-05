import { Injectable } from '@nestjs/common'
import { ROLE, TICKET_EVENT } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { TransitionTicketUseCase } from '../core/transition-ticket.usecase'
import { NotTicketOwnerError } from '../core/ticket-errors'
import { TicketNotFoundError } from '../../domain/errors'

/**
 * Return 2-phase, step 2 (B3): the Applicant confirms the hardcopy is back in
 * hand → `Returned → Return-fixing`, which opens the fix window and starts the
 * SLA-3 clock. Status is guarded by the edge (transition rejects any other
 * from-state); ownership is enforced here.
 */
@Injectable()
export class ConfirmReturnReceiptUseCase {
  constructor(
    private readonly repo: TicketQueryRepo,
    private readonly transition: TransitionTicketUseCase,
  ) {}

  async execute(req: { ticketId: string; actorSub: string }): Promise<void> {
    const ticket = await this.repo.findByIdForApplicant(req.ticketId, req.actorSub)
    if (!ticket) throw new TicketNotFoundError(req.ticketId)
    if (ticket.applicantSub !== req.actorSub) throw new NotTicketOwnerError()
    await this.transition.execute({
      ticketId: req.ticketId,
      event: TICKET_EVENT.ConfirmReturnReceipt,
      actor: { sub: req.actorSub, activeRole: ROLE.Applicant },
    })
  }
}

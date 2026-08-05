import { Injectable } from '@nestjs/common'
import { ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { TransitionTicketUseCase } from '../core/transition-ticket.usecase'
import { NotTicketOwnerError, PriorityLockedError } from '../core/ticket-errors'
import { TicketNotFoundError } from '../../domain/errors'

export interface CancelTicketRequest {
  ticketId: string
  actorSub: string
}

/**
 * Withdraw a ticket (FR-4): only the owner, only while Submitted with no one
 * having picked it up. Cancel is a transition (Submitted → Cancelled) so it is
 * audited (AD-2) — never a silent delete.
 */
@Injectable()
export class CancelTicketUseCase {
  constructor(
    private readonly repo: TicketQueryRepo,
    private readonly transition: TransitionTicketUseCase,
  ) {}

  async execute(req: CancelTicketRequest): Promise<void> {
    const ticket = await this.repo.findByIdForApplicant(req.ticketId, req.actorSub)
    if (!ticket) throw new TicketNotFoundError(req.ticketId)
    if (ticket.applicantSub !== req.actorSub) throw new NotTicketOwnerError()
    if (ticket.status !== TICKET_STATUS.Submitted || ticket.currentHolderSub !== null) {
      // Already picked up → the button is gone; guard the API too.
      throw new PriorityLockedError('Hồ sơ đã được bốc, không thể thu hồi')
    }
    await this.transition.execute({
      ticketId: req.ticketId,
      event: TICKET_EVENT.Cancel,
      actor: { sub: req.actorSub, activeRole: ROLE.Applicant },
    })
  }
}

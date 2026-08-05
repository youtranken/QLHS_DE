import { Injectable } from '@nestjs/common'
import { ROLE, TICKET_EVENT } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { TransitionTicketUseCase } from '../core/transition-ticket.usecase'
import { NotTicketOwnerError } from '../core/ticket-errors'
import { TicketNotFoundError } from '../../domain/errors'

/**
 * Applicant re-submits a fixed ticket (FR-16): `Return-fixing → Submitted`, back
 * into the Pool for the same round (the round was already counted at a heavy
 * Return). Code + data + timeline are preserved (AD-5) — the edge does not mint.
 */
@Injectable()
export class ResubmitTicketUseCase {
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
      event: TICKET_EVENT.Resubmit,
      actor: { sub: req.actorSub, activeRole: ROLE.Applicant },
    })
  }
}

import { Injectable } from '@nestjs/common'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'
import type { ApplicantFields } from '../../domain/ticket/applicant-fields'

/**
 * Applicant edits the 9 fields (FR-16). The repo enforces the field-mutability
 * window — in Pool (`Submitted`) or during a return round (`Return-fixing`) — and
 * audits each change as a `field_changed` event (B6); this use-case just carries
 * the intent through.
 */
@Injectable()
export class UpdateFieldsUseCase {
  constructor(private readonly repo: TicketWriteRepo) {}

  execute(req: { ticketId: string; actorSub: string; fields: ApplicantFields }): Promise<void> {
    return this.repo.updateFields(req.ticketId, req.actorSub, req.fields)
  }
}

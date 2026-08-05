import { Injectable } from '@nestjs/common'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'
import { FlowResolver } from './flow-resolver'
import type { ApplicantFields } from '../../domain/ticket/applicant-fields'

/**
 * Applicant edits the 9 fields (FR-16). The repo enforces the field-mutability
 * window — in Pool (`Submitted`) or during a return round (`Return-fixing`) — and
 * audits each change as a `field_changed` event (B6). We resolve the flow from
 * the catalog here (rejecting an invalid documentType) and hand it down so the
 * repo keeps flow in sync when documentType crosses a flow boundary in Pool —
 * a bare mapFlow there returned undefined for admin-added types and silently
 * desynced flow from documentType.
 */
@Injectable()
export class UpdateFieldsUseCase {
  constructor(
    private readonly repo: TicketWriteRepo,
    private readonly flow: FlowResolver,
  ) {}

  async execute(req: { ticketId: string; actorSub: string; fields: ApplicantFields }): Promise<void> {
    const flow = await this.flow.resolve(req.fields.documentType)
    return this.repo.updateFields(req.ticketId, req.actorSub, req.fields, flow)
  }
}

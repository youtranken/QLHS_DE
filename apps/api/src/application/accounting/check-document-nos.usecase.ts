import { Injectable } from '@nestjs/common'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'

/**
 * Batch send-to-Accounting pre-flight: given the Document Nos a DCC2/DCC3 is about
 * to enter, return the subset already taken by a live (non-Cancelled) ticket. Lets
 * the batch sheet flag a clash BEFORE sending anything, so a known duplicate never
 * half-sends the batch and strands one row. Read-only; the DB partial-unique index
 * remains the final TOCTOU guard on the actual send.
 */
@Injectable()
export class CheckDocumentNosUseCase {
  constructor(private readonly tickets: TicketQueryRepo) {}

  execute(documentNos: string[]): Promise<string[]> {
    return this.tickets.existingDocumentNos(documentNos)
  }
}

import { Injectable } from '@nestjs/common'
import type { Priority } from '@qlhs/contracts'
import { mapFlow } from '../../domain/ticket/document-flow'
import type { ApplicantFields } from '../../domain/ticket/applicant-fields'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'

export interface CreateTicketRequest {
  applicantSub: string
  fields: ApplicantFields
  priority: Priority
}

@Injectable()
export class CreateTicketUseCase {
  constructor(private readonly repo: TicketWriteRepo) {}

  execute(req: CreateTicketRequest): Promise<{ id: string }> {
    const flow = mapFlow(req.fields.documentType)
    return this.repo.create({
      applicantSub: req.applicantSub,
      flow,
      priority: req.priority,
      fields: req.fields,
    })
  }
}

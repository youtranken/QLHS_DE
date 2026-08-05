import { Injectable } from '@nestjs/common'
import type { Priority } from '@qlhs/contracts'
import type { ApplicantFields } from '../../domain/ticket/applicant-fields'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'
import { FlowResolver } from './flow-resolver'

export interface CreateTicketRequest {
  applicantSub: string
  fields: ApplicantFields
  priority: Priority
}

@Injectable()
export class CreateTicketUseCase {
  constructor(
    private readonly repo: TicketWriteRepo,
    private readonly flow: FlowResolver,
  ) {}

  async execute(req: CreateTicketRequest): Promise<{ id: string }> {
    const flow = await this.flow.resolve(req.fields.documentType)
    return this.repo.create({
      applicantSub: req.applicantSub,
      flow,
      priority: req.priority,
      fields: req.fields,
    })
  }
}

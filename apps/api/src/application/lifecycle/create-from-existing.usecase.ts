import { Injectable } from '@nestjs/common'
import { type DocumentType, type Priority, PRIORITY } from '@qlhs/contracts'
import { mapFlow } from '../../domain/ticket/document-flow'
import { cloneFields, type ApplicantFields } from '../../domain/ticket/applicant-fields'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'
import { TicketNotFoundError } from '../../domain/errors'

export interface CreateFromExistingRequest {
  applicantSub: string
  sourceTicketId: string
  priority?: Priority
}

/**
 * "Create from existing" (FR-3): copies ONLY the 9 fields from a source ticket
 * the applicant owns. New ticket starts clean (code=NULL, round_no=0).
 */
@Injectable()
export class CreateFromExistingUseCase {
  constructor(
    private readonly repo: TicketQueryRepo,
    private readonly writes: TicketWriteRepo,
  ) {}

  async execute(req: CreateFromExistingRequest): Promise<{ id: string }> {
    const source = await this.repo.findByIdForApplicant(req.sourceTicketId, req.applicantSub)
    if (!source || source.documentType === null || source.amount === null) {
      throw new TicketNotFoundError('Không tìm thấy hồ sơ nguồn để sao')
    }
    const fields: ApplicantFields = cloneFields({
      documentType: source.documentType as DocumentType,
      description: source.description ?? '',
      paymentTerm: source.paymentTerm ?? '',
      contractNo: source.contractNo ?? '',
      projectTeam: source.projectTeam ?? '',
      currency: source.currency ?? '',
      amount: source.amount,
      budgetCode: source.budgetCode ?? '',
      contractor: source.contractor ?? '',
    })
    return this.writes.create({
      applicantSub: req.applicantSub,
      flow: mapFlow(fields.documentType),
      priority: req.priority ?? PRIORITY.Normal,
      fields,
    })
  }
}

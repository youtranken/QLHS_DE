import { BadRequestException, Injectable } from '@nestjs/common'
import type { DocumentType, Flow, Priority } from '@qlhs/contracts'
import { mapFlow } from '../../domain/ticket/document-flow'
import type { ApplicantFields } from '../../domain/ticket/applicant-fields'
import { TicketWriteRepo } from '../../infra/prisma/ticket/ticket-write.repo'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'

export interface CreateTicketRequest {
  applicantSub: string
  fields: ApplicantFields
  priority: Priority
}

@Injectable()
export class CreateTicketUseCase {
  constructor(
    private readonly repo: TicketWriteRepo,
    private readonly options: OptionRepo,
  ) {}

  async execute(req: CreateTicketRequest): Promise<{ id: string }> {
    const flow = await this.resolveFlow(req.fields.documentType)
    return this.repo.create({
      applicantSub: req.applicantSub,
      flow,
      priority: req.priority,
      fields: req.fields,
    })
  }

  /** Luồng suy từ catalog document type (nguồn chính — gồm 6 loại seed sẵn + loại
   *  admin thêm). Fallback mapFlow cho 6 built-in (an toàn nếu catalog trống). Loại
   *  không xác định được luồng bị từ chối — catalog là chân lý về loại hợp lệ. */
  private async resolveFlow(documentType: string): Promise<Flow> {
    const fromCatalog = await this.options.flowForDocType(documentType)
    if (fromCatalog) return fromCatalog as Flow
    const builtin = mapFlow(documentType as DocumentType) as Flow | undefined
    if (builtin) return builtin
    throw new BadRequestException({ code: 'InvalidDocumentType', message: 'Loại hồ sơ không hợp lệ' })
  }
}

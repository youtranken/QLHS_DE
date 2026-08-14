import { Injectable } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { DOCUMENT_NO_NA, isValidDocumentNo } from '../../domain/ticket/document-no'
import { AccountingRepo } from '../../infra/prisma/ticket/accounting.repo'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { DocumentNoInvalidError } from '../core/ticket-errors'
import { TicketNotFoundError } from '../../domain/errors'

/** DCC2 sends the Contract file to Accounting (FR-11). Whether a Contract No is
 *  mandatory depends on the document type (bảng ma trận Admin): loại bật cờ
 *  `requiresContractNo` (vd Contract) phải nhập số hợp lệ; loại khác (VO/Annex,
 *  hoặc Budget khi không skip) gửi thẳng với sentinel 'N/A' (unique index bỏ qua). */
@Injectable()
export class SubmitToAccountingUseCase {
  constructor(
    private readonly repo: AccountingRepo,
    private readonly tickets: TicketQueryRepo,
    private readonly options: OptionRepo,
    private readonly clock: SystemClock,
  ) {}

  async execute(req: { ticketId: string; actorSub: string; documentNo: string }): Promise<{ status: string }> {
    const ticket = await this.tickets.findById(req.ticketId)
    if (!ticket) throw new TicketNotFoundError(req.ticketId)
    const caps = ticket.documentType
      ? await this.options.docTypeCapabilities(ticket.documentType)
      : { requiresContractNo: false, allowSkip: false }

    const raw = req.documentNo.trim()
    let documentNo: string
    if (caps.requiresContractNo) {
      if (!isValidDocumentNo(raw)) throw new DocumentNoInvalidError('Vui lòng nhập Contract No.')
      documentNo = raw
    } else {
      // Loại không yêu cầu số → gửi thẳng; 'N/A' (bị loại khỏi unique index) cho phép
      // nhiều hồ sơ cùng đóng mà không đụng ràng buộc 1-1 của Contract thật.
      documentNo = raw && isValidDocumentNo(raw) ? raw : DOCUMENT_NO_NA
    }

    return this.repo.submitToAccounting(
      req.ticketId,
      { sub: req.actorSub, activeRole: ROLE.Dcc2 },
      documentNo,
      this.clock.now(),
    )
  }
}

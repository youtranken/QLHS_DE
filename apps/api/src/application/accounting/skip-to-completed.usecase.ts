import { BadRequestException, Injectable } from '@nestjs/common'
import { SkipToCompletedRepo } from '../../infra/prisma/ticket/skip-to-completed.repo'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { DOCUMENT_NO_NA, isValidDocumentNo } from '../../domain/ticket/document-no'
import { DocumentNoInvalidError } from '../core/ticket-errors'
import { TicketNotFoundError } from '../../domain/errors'

/** DCC2 "Skip to Completed": fast-forward a Contract from `Received by DCC2` to
 *  `Completed` in one atomic chain (repo). Chỉ loại bật cờ `allowSkip` (bảng ma
 *  trận Admin) mới được skip — guard server-side, không tin mỗi UI. Số Contract No:
 *  loại cũng bật `requiresContractNo` (vd Service Contract) BẮT BUỘC nhập số hợp lệ
 *  ngay cả khi skip; loại chỉ-Skip thì tuỳ chọn ("có thì nhập, không thì N/A" —
 *  excluded khỏi unique index). Hai cờ độc lập, không còn loại trừ nhau. */
@Injectable()
export class SkipToCompletedUseCase {
  constructor(
    private readonly repo: SkipToCompletedRepo,
    private readonly tickets: TicketQueryRepo,
    private readonly options: OptionRepo,
    private readonly clock: SystemClock,
  ) {}

  async execute(req: {
    ticketId: string
    actorSub: string
    documentNo?: string
  }): Promise<{ status: string }> {
    const ticket = await this.tickets.findById(req.ticketId)
    if (!ticket) throw new TicketNotFoundError(req.ticketId)
    const caps = ticket.documentType
      ? await this.options.docTypeCapabilities(ticket.documentType)
      : { requiresContractNo: false, allowSkip: false }
    if (!caps.allowSkip) {
      throw new BadRequestException({
        code: 'SkipNotAllowed',
        message: 'Loại hồ sơ này không cho phép Skip to Completed',
      })
    }
    const trimmed = req.documentNo?.trim() ?? ''
    // Loại vừa yêu cầu số (requiresContractNo) → skip vẫn phải kèm số hợp lệ, không
    // cho đóng bằng N/A; loại chỉ-Skip thì số tuỳ chọn (trống → N/A).
    if (caps.requiresContractNo && !isValidDocumentNo(trimmed)) {
      throw new DocumentNoInvalidError('Vui lòng nhập Contract No.')
    }
    const documentNo = isValidDocumentNo(trimmed) ? trimmed : DOCUMENT_NO_NA
    return this.repo.skip(req.ticketId, req.actorSub, documentNo, this.clock.now())
  }
}

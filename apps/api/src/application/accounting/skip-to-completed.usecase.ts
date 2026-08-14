import { BadRequestException, Injectable } from '@nestjs/common'
import { SkipToCompletedRepo } from '../../infra/prisma/ticket/skip-to-completed.repo'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { TicketNotFoundError } from '../../domain/errors'

/** DCC2 "Skip to Completed": fast-forward a Contract from `Received by DCC2` to
 *  `Completed` in one atomic chain (repo). Chỉ loại bật cờ `allowSkip` (bảng ma
 *  trận Admin) mới được skip — guard server-side, không tin mỗi UI. Contract No là
 *  tuỳ chọn: "nhập nếu có, không thì N/A" (excluded khỏi unique index). */
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
    const trimmed = req.documentNo?.trim()
    const documentNo = trimmed ? trimmed : 'N/A'
    return this.repo.skip(req.ticketId, req.actorSub, documentNo, this.clock.now())
  }
}

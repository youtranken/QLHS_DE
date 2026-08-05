import { Injectable } from '@nestjs/common'
import { ALL_ROLES, type Role } from '@qlhs/contracts'
import { TicketDetailUseCase } from '../../application/core/ticket-detail.usecase'
import { TOOL } from '../intent/types'
import { type AssistantTool, type Caller } from '../assistant-tool'

/** Chi tiết hồ sơ. Use-case nhận cả code lẫn UUID và tự chặn cross-user (ném
 *  TicketNotFoundError cho cả "không tồn tại" lẫn "không có quyền") — không oracle. */
@Injectable()
export class GetTicketDetailTool implements AssistantTool {
  readonly name = TOOL.TicketDetail
  readonly activeRoles: readonly Role[] = ALL_ROLES
  constructor(private readonly uc: TicketDetailUseCase) {}

  run(args: Record<string, unknown>, caller: Caller): Promise<unknown> {
    // Read-only: merely asking for a ticket must NOT clear its unseen badge (AD-18),
    // same guard as WhatsNextTool.
    return this.uc.execute(String(args.code ?? ''), { role: caller.activeRole, sub: caller.sub }, { markSeen: false })
  }
}

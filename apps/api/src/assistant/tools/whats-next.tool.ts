import { Injectable } from '@nestjs/common'
import { ALL_ROLES, type Role } from '@qlhs/contracts'
import { TicketDetailUseCase } from '../../application/core/ticket-detail.usecase'
import { TOOL } from '../intent/types'
import { type AssistantTool, type Caller } from '../assistant-tool'

/** "Bước tiếp theo" đi QUA ticket-detail (đọc field `actions`) — KHÔNG dùng
 *  legal-actions trần (chỉ UUID + không guard sở hữu → oracle trạng thái). Chỉ
 *  liệt kê, KHÔNG thực thi (read-only). */
@Injectable()
export class WhatsNextTool implements AssistantTool {
  readonly name = TOOL.WhatsNext
  readonly activeRoles: readonly Role[] = ALL_ROLES
  constructor(private readonly uc: TicketDetailUseCase) {}

  run(args: Record<string, unknown>, caller: Caller): Promise<unknown> {
    // Chỉ hỏi "bước tiếp theo" → KHÔNG đánh dấu đã xem (D2 review).
    return this.uc.execute(String(args.code ?? ''), { role: caller.activeRole, sub: caller.sub }, { markSeen: false })
  }
}

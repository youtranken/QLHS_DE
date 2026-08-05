import { Injectable } from '@nestjs/common'
import { ROLE, type Role } from '@qlhs/contracts'
import { ListWorkboxUseCase } from '../../application/board/list-workbox.usecase'
import { StationBoardUseCase } from '../../application/dispatch/station-board.usecase'
import { TOOL, TOOL_ROLES } from '../intent/types'
import { type TicketRowVM } from '../render/answer'
import { type AssistantTool, type Caller } from '../assistant-tool'

/** "Bàn của tôi": DCC1 dùng workbox (trạm không-Pool); DCC2/DCC3 dùng bảng trạm
 *  của mình (`StationBoardUseCase`, vì `list-workbox` cứng DCC1). Chuẩn hoá về
 *  một danh sách để render bảng chung. */
@Injectable()
export class GetMyWorkboxTool implements AssistantTool {
  readonly name = TOOL.Workbox
  readonly activeRoles: readonly Role[] = TOOL_ROLES[TOOL.Workbox]
  constructor(
    private readonly workbox: ListWorkboxUseCase,
    private readonly board: StationBoardUseCase,
  ) {}

  async run(_args: Record<string, unknown>, caller: Caller): Promise<TicketRowVM[]> {
    if (caller.activeRole === ROLE.Dcc1) {
      const cards = await this.workbox.execute()
      return cards.map((c) => ({ code: c.code, flow: c.flow, status: c.status, priority: c.priority, overdueDays: c.overdueDays }))
    }
    const cols = await this.board.execute(caller.activeRole, caller.sub)
    return cols.flatMap((col) =>
      col.cards.map((c) => ({ code: c.code, flow: c.flow, status: c.status, priority: c.priority, overdueDays: c.overdueDays })),
    )
  }
}

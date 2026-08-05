import { Injectable } from '@nestjs/common'
import { type Role } from '@qlhs/contracts'
import { ListSlaPausesUseCase } from '../../application/sla/list-sla-pauses.usecase'
import { TOOL, TOOL_ROLES } from '../intent/types'
import { type AssistantTool } from '../assistant-tool'

/** "Hồ sơ đang chờ bổ sung / tạm dừng SLA" — báo cáo oversight (Admin). */
@Injectable()
export class GetPausedTicketsTool implements AssistantTool {
  readonly name = TOOL.Paused
  readonly activeRoles: readonly Role[] = TOOL_ROLES[TOOL.Paused]
  constructor(private readonly uc: ListSlaPausesUseCase) {}

  run(): Promise<unknown> {
    return this.uc.execute()
  }
}

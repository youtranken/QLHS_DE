import { Injectable } from '@nestjs/common'
import { type Role } from '@qlhs/contracts'
import { StationTicketsUseCase } from '../../application/dispatch/dispatch-map.usecase'
import { TOOL, TOOL_ROLES } from '../intent/types'
import { type AssistantTool, type Caller } from '../assistant-tool'

@Injectable()
export class GetStationTicketsTool implements AssistantTool {
  readonly name = TOOL.StationTickets
  readonly activeRoles: readonly Role[] = TOOL_ROLES[TOOL.StationTickets]
  constructor(private readonly uc: StationTicketsUseCase) {}

  run(args: Record<string, unknown>, caller: Caller): Promise<unknown> {
    const flow = typeof args.flow === 'string' ? args.flow : undefined
    return this.uc.execute(String(args.status ?? ''), caller.activeRole, flow)
  }
}

import { Injectable } from '@nestjs/common'
import { ALL_ROLES, type Role } from '@qlhs/contracts'
import { ListMyTicketsUseCase } from '../../application/lifecycle/list-my-tickets.usecase'
import { TOOL } from '../intent/types'
import { type AssistantTool, type Caller } from '../assistant-tool'

@Injectable()
export class GetMyTicketsTool implements AssistantTool {
  readonly name = TOOL.MyTickets
  readonly activeRoles: readonly Role[] = ALL_ROLES
  constructor(private readonly uc: ListMyTicketsUseCase) {}

  run(_args: Record<string, unknown>, caller: Caller): Promise<unknown> {
    return this.uc.execute(caller.sub)
  }
}

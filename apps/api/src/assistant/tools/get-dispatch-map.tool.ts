import { Injectable } from '@nestjs/common'
import { type Role } from '@qlhs/contracts'
import { DispatchMapUseCase } from '../../application/dispatch/dispatch-map.usecase'
import { TOOL, TOOL_ROLES } from '../intent/types'
import { type AssistantTool, type Caller } from '../assistant-tool'

@Injectable()
export class GetDispatchMapTool implements AssistantTool {
  readonly name = TOOL.DispatchMap
  readonly activeRoles: readonly Role[] = TOOL_ROLES[TOOL.DispatchMap]
  constructor(private readonly uc: DispatchMapUseCase) {}

  run(_args: Record<string, unknown>, caller: Caller): Promise<unknown> {
    return this.uc.execute(caller.activeRole)
  }
}

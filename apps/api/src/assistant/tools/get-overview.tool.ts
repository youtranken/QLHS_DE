import { Injectable } from '@nestjs/common'
import { type Role } from '@qlhs/contracts'
import { GetAdminOverviewUseCase } from '../../application/admin/get-admin-overview.usecase'
import { TOOL, TOOL_ROLES } from '../intent/types'
import { type AssistantTool } from '../assistant-tool'

@Injectable()
export class GetOverviewTool implements AssistantTool {
  readonly name = TOOL.Overview
  readonly activeRoles: readonly Role[] = TOOL_ROLES[TOOL.Overview]
  constructor(private readonly uc: GetAdminOverviewUseCase) {}

  run(): Promise<unknown> {
    return this.uc.execute()
  }
}

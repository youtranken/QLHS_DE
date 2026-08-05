import { Injectable } from '@nestjs/common'
import { type Role } from '@qlhs/contracts'
import { GetAnalyticsUseCase } from '../../application/admin/get-analytics.usecase'
import { TOOL, TOOL_ROLES } from '../intent/types'
import { type AssistantTool } from '../assistant-tool'

@Injectable()
export class GetAnalyticsTool implements AssistantTool {
  readonly name = TOOL.Analytics
  readonly activeRoles: readonly Role[] = TOOL_ROLES[TOOL.Analytics]
  constructor(private readonly uc: GetAnalyticsUseCase) {}

  run(args: Record<string, unknown>): Promise<unknown> {
    return this.uc.execute(args.period === 'week' ? 'week' : 'month')
  }
}
